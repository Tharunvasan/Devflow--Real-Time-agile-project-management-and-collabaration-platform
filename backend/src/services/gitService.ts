import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export interface GitLogOptions {
  branch?: string;
  maxCount?: number;
  skip?: number;
  path?: string;
}

export interface CommitInfo {
  hash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  message: string;
}

export class GitService {
  /**
   * Run a raw git command safely
   */
  private static async runGitCommand(repoPath: string, args: string[]): Promise<string> {
    // Validate repository path to prevent path traversal
    const resolvedPath = path.resolve(repoPath);
    
    // Check if path exists and is a directory
    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        throw new Error('Repository path is not a directory');
      }
      
      // Ensure it's a git repo
      const gitDirStats = await fs.stat(path.join(resolvedPath, '.git'));
      if (!gitDirStats.isDirectory() && !gitDirStats.isFile()) { // .git can be a file in worktrees
        throw new Error('Not a git repository');
      }
    } catch (err: any) {
      throw new Error(`Invalid repository path: ${err.message}`);
    }

    return new Promise((resolve, reject) => {
      // Use spawn with detached false, passing args as array to prevent shell injection
      const gitProcess = spawn('git', args, {
        cwd: resolvedPath,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });

      let stdout = '';
      let stderr = '';

      gitProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      gitProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      gitProcess.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Git command failed: ${stderr.trim()}`));
        }
      });
      
      gitProcess.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Get branches
   */
  static async getBranches(repoPath: string): Promise<string[]> {
    try {
      const output = await this.runGitCommand(repoPath, ['branch', '--list', '--format=%(refname:short)']);
      return output.split('\n').map(b => b.trim()).filter(Boolean);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get commit history
   */
  static async getCommits(repoPath: string, options: GitLogOptions = {}): Promise<CommitInfo[]> {
    const args = ['log', '--pretty=format:%H|%an|%ae|%aI|%s'];
    
    if (options.maxCount) args.push(`-n${options.maxCount}`);
    if (options.skip) args.push(`--skip=${options.skip}`);
    if (options.branch) args.push(options.branch);
    if (options.path) {
      args.push('--');
      args.push(options.path);
    }

    try {
      const output = await this.runGitCommand(repoPath, args);
      if (!output) return [];
      
      return output.split('\n').map(line => {
        const [hash, authorName, authorEmail, date, message] = line.split('|');
        return { hash, authorName, authorEmail, date, message };
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get file tree at a specific commit or branch
   */
  static async getTree(repoPath: string, ref: string = 'HEAD', dirPath: string = ''): Promise<{ name: string, type: 'blob' | 'tree', mode: string }[]> {
    try {
      const target = dirPath ? `${ref}:${dirPath}` : ref;
      const output = await this.runGitCommand(repoPath, ['ls-tree', target]);
      if (!output) return [];
      
      return output.split('\n').map(line => {
        const [mode, type, hashAndName] = line.split(' ').filter(Boolean);
        const [hash, name] = hashAndName.split('\t');
        return { name, type: type as 'blob' | 'tree', mode };
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get file content
   */
  static async getFileContent(repoPath: string, ref: string, filePath: string): Promise<string> {
    try {
      return await this.runGitCommand(repoPath, ['show', `${ref}:${filePath}`]);
    } catch (error) {
      throw error;
    }
  }
}
