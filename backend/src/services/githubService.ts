import { AppError } from '../middleware/errorHandler';
import { config } from '../config/config';

// In a real application, we would retrieve this from the DB (e.g., user.githubAccessToken or Project.githubInstallationToken)
// For this implementation, we can accept the token dynamically.
export class GitHubService {
  private static async getClient(token?: string) {
    if (!token && !process.env.GITHUB_TOKEN) {
      throw new AppError('GitHub token is required to access GitHub API', 401);
    }
    const { Octokit } = await import('@octokit/rest');
    return new Octokit({ auth: token || process.env.GITHUB_TOKEN });
  }

  static async getBranches(owner: string, repo: string, token?: string) {
    try {
      const octokit = await this.getClient(token);
      const { data } = await octokit.repos.listBranches({ owner, repo });
      return data.map(b => b.name);
    } catch (error: any) {
      throw new AppError(`GitHub API Error: ${error.message}`, error.status || 500);
    }
  }

  static async getCommits(owner: string, repo: string, branch?: string, token?: string, perPage = 50, page = 1) {
    try {
      const octokit = await this.getClient(token);
      const { data } = await octokit.repos.listCommits({
        owner,
        repo,
        sha: branch,
        per_page: perPage,
        page,
      });

      return data.map(commit => ({
        hash: commit.sha,
        authorName: commit.commit.author?.name || 'Unknown',
        authorEmail: commit.commit.author?.email || 'Unknown',
        date: commit.commit.author?.date || '',
        message: commit.commit.message,
      }));
    } catch (error: any) {
      throw new AppError(`GitHub API Error: ${error.message}`, error.status || 500);
    }
  }

  static async getTree(owner: string, repo: string, ref: string, path: string = '', token?: string) {
    try {
      const octokit = await this.getClient(token);
      
      // If path is provided, we need to get the directory contents, otherwise get root tree
      if (path) {
        const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
        if (Array.isArray(data)) {
          return data.map(item => ({
            name: item.name,
            type: item.type === 'dir' ? 'tree' : 'blob',
            mode: item.type === 'dir' ? '040000' : '100644', // approximations
          }));
        }
        return [];
      } else {
        // Fetch root commit to get root tree sha
        const { data: commitData } = await octokit.repos.getCommit({ owner, repo, ref });
        const treeSha = commitData.commit.tree.sha;
        
        const { data: treeData } = await octokit.git.getTree({ owner, repo, tree_sha: treeSha });
        return treeData.tree.map(item => ({
          name: item.path || '',
          type: item.type === 'blob' ? 'blob' : 'tree',
          mode: item.mode || '',
        }));
      }
    } catch (error: any) {
      throw new AppError(`GitHub API Error: ${error.message}`, error.status || 500);
    }
  }
}
