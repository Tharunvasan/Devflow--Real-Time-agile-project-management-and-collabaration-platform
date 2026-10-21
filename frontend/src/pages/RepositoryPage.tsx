import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { repositoryService } from '../services/repositoryService';
import type { Repository, Commit, GitTreeItem } from '../services/repositoryService';
import { LoadingSpinner, EmptyState } from '../components/ui/LoadingSpinner';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export const RepositoryPage: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRepo, setActiveRepo] = useState<Repository | null>(null);
  
  const [branches, setBranches] = useState<string[]>([]);
  const [activeBranch, setActiveBranch] = useState<string>('');
  
  const [commits, setCommits] = useState<Commit[]>([]);
  const [tree, setTree] = useState<GitTreeItem[]>([]);
  
  const [view, setView] = useState<'CODE' | 'COMMITS'>('CODE');
  
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [form, setForm] = useState({ name: '', source: 'LOCAL' as 'LOCAL' | 'GITHUB', path: '', url: '' });

  useEffect(() => {
    if (!projectId) return;
    fetchRepos();
  }, [projectId]);

  const fetchRepos = async () => {
    try {
      setLoading(true);
      const repos = await repositoryService.getRepositories(projectId!);
      setRepositories(repos);
      if (repos.length > 0) {
        handleSelectRepo(repos[0]);
      }
    } catch {
      toast.error('Failed to load repositories');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRepo = async (repo: Repository) => {
    setActiveRepo(repo);
    try {
      const branchList = await repositoryService.getBranches(repo._id);
      setBranches(branchList);
      const currentBranch = branchList.find(b => b === 'main' || b === 'master') || branchList[0] || '';
      setActiveBranch(currentBranch);
      if (currentBranch) {
        fetchRepoData(repo._id, currentBranch);
      }
    } catch {
      toast.error('Failed to load branch data');
    }
  };

  const fetchRepoData = async (repoId: string, branch: string) => {
    try {
      const [commitsData, treeData] = await Promise.all([
        repositoryService.getCommits(repoId, branch),
        repositoryService.getTree(repoId, branch)
      ]);
      setCommits(commitsData);
      setTree(treeData);
    } catch {
      toast.error('Failed to load repo data');
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await repositoryService.linkRepository({ ...form, projectId: projectId! });
      toast.success('Repository linked successfully');
      setShowLinkModal(false);
      fetchRepos();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to link repository');
    }
  };

  if (loading) return <LoadingSpinner fullPage text="Loading repositories..." />;

  if (repositories.length === 0) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="No repositories linked"
          description="Connect a Git repository to start tracking code alongside your tasks."
          action={<button onClick={() => setShowLinkModal(true)} className="btn-primary">Link Repository</button>}
        />
        {renderLinkModal()}
      </div>
    );
  }

  function renderLinkModal() {
    if (!showLinkModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-dark-900 border border-dark-800 rounded-xl shadow-2xl w-full max-w-md p-6">
          <h2 className="text-xl font-bold text-white mb-4">Link Repository</h2>
          <form onSubmit={handleLinkSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Repository Name</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" required placeholder="e.g. backend-service" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Source</label>
              <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value as any })} className="input-field">
                <option value="LOCAL">Local Git Repository</option>
                <option value="GITHUB">GitHub Repository</option>
              </select>
            </div>
            {form.source === 'LOCAL' ? (
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Absolute Path on Server</label>
                <input type="text" value={form.path} onChange={e => setForm({ ...form, path: e.target.value })} className="input-field" required placeholder="/path/to/repo" />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">GitHub URL</label>
                <input type="text" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="input-field" required placeholder="https://github.com/owner/repo" />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setShowLinkModal(false)} className="btn-ghost">Cancel</button>
              <button type="submit" className="btn-primary">Link Repository</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {repositories.map(repo => (
            <button 
              key={repo._id} 
              onClick={() => handleSelectRepo(repo)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeRepo?._id === repo._id ? 'bg-primary-600 text-white' : 'bg-dark-800 text-dark-300 hover:bg-dark-700'}`}
            >
              {repo.name}
            </button>
          ))}
          <button onClick={() => setShowLinkModal(true)} className="px-4 py-2 rounded-lg text-sm font-medium bg-dark-800 text-dark-300 border border-dashed border-dark-600 hover:bg-dark-700">
            + Add
          </button>
        </div>
        
        {activeRepo && (
          <div className="flex gap-2">
            <select 
              value={activeBranch} 
              onChange={(e) => {
                setActiveBranch(e.target.value);
                fetchRepoData(activeRepo._id, e.target.value);
              }}
              className="input-field py-1"
            >
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}
      </div>

      {activeRepo && (
        <div className="card overflow-hidden">
          <div className="border-b border-dark-700 flex gap-4 px-4 bg-dark-800">
            <button onClick={() => setView('CODE')} className={`py-3 text-sm font-medium border-b-2 ${view === 'CODE' ? 'border-primary-500 text-primary-400' : 'border-transparent text-dark-400 hover:text-white'}`}>
              Code
            </button>
            <button onClick={() => setView('COMMITS')} className={`py-3 text-sm font-medium border-b-2 ${view === 'COMMITS' ? 'border-primary-500 text-primary-400' : 'border-transparent text-dark-400 hover:text-white'}`}>
              Commits
            </button>
          </div>
          
          <div className="p-0">
            {view === 'CODE' && (
              <div className="divide-y divide-dark-800">
                {commits[0] && (
                  <div className="bg-dark-800/50 px-4 py-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-dark-200">
                      <span className="font-semibold text-white">{commits[0].authorName}</span>
                      <span>{commits[0].message}</span>
                    </div>
                    <div className="text-dark-500 flex gap-3">
                      <span>{commits[0].hash.substring(0, 7)}</span>
                      <span>{formatDistanceToNow(new Date(commits[0].date), { addSuffix: true })}</span>
                    </div>
                  </div>
                )}
                {tree.map(item => (
                  <div key={item.name} className="px-4 py-3 flex items-center gap-3 hover:bg-dark-750 transition-colors cursor-pointer group">
                    {item.type === 'tree' ? (
                      <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                    ) : (
                      <svg className="w-5 h-5 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    )}
                    <span className="text-sm text-dark-200 group-hover:text-primary-400 transition-colors">{item.name}</span>
                  </div>
                ))}
              </div>
            )}
            
            {view === 'COMMITS' && (
              <div className="divide-y divide-dark-800">
                {commits.map(commit => (
                  <div key={commit.hash} className="px-4 py-4 hover:bg-dark-750 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-medium text-white">{commit.message}</h4>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-primary-400 bg-primary-900/20 px-2 py-1 rounded">{commit.hash.substring(0, 7)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-dark-400">
                      <span className="font-medium text-dark-300">{commit.authorName}</span>
                      <span>committed {formatDistanceToNow(new Date(commit.date), { addSuffix: true })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {renderLinkModal()}
    </div>
  );
};
