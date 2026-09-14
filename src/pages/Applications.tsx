export default function Applications() {
  const columns = [
    { id: 'saved', title: 'Saved / Researching', color: 'bg-slate-100 dark:bg-slate-800/50' },
    { id: 'applied', title: 'Applied', color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/50' },
    { id: 'interview', title: 'Interview / Assessment', color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-900/50' },
    { id: 'offer', title: 'Offer / Accepted', color: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/50' },
    { id: 'rejected', title: 'Rejected', color: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/50' }
  ];

  const mockApplications = [
    { id: 1, title: 'Summer Analyst Programme 2027', org: 'JPMorgan Chase', status: 'saved', deadline: '2026-10-15' },
    { id: 2, title: 'Software Engineering Graduate', org: 'Goldman Sachs', status: 'applied', dateApplied: '2026-09-01' },
    { id: 3, title: 'Global Leaders Scholarship', org: 'Oxford University', status: 'interview', dateApplied: '2026-08-20', nextStep: 'Panel Interview on Sep 20' }
  ];

  return (
    <div className="flex flex-col gap-6 pb-10 h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Applications</h1>
          <p className="text-muted-foreground mt-1">Track your progress and stay on top of deadlines.</p>
        </div>
        <button className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md font-medium shadow-sm transition-all active:scale-95 flex items-center gap-2">
          <span>➕</span> Add Application
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-6 overflow-x-auto pb-4 h-full scrollbar-thin">
        {columns.map(col => (
          <div key={col.id} className={`flex-shrink-0 w-80 rounded-xl border ${col.color} flex flex-col`}>
            <div className="p-4 border-b bg-background/50 backdrop-blur-sm rounded-t-xl flex justify-between items-center">
              <h3 className="font-semibold">{col.title}</h3>
              <span className="bg-background text-foreground text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                {mockApplications.filter(a => a.status === col.id).length}
              </span>
            </div>
            
            <div className="p-3 flex-1 overflow-y-auto space-y-3">
              {mockApplications.filter(a => a.status === col.id).map(app => (
                <div key={app.id} className="bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-sm leading-tight text-foreground">{app.title}</h4>
                    <button className="text-muted-foreground hover:text-foreground">⋮</button>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mb-3">{app.org}</p>
                  
                  {app.deadline && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/50 px-2 py-1 rounded-md w-max mt-2">
                      ⏳ Due {app.deadline}
                    </div>
                  )}
                  {app.dateApplied && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                      📅 Applied {app.dateApplied}
                    </div>
                  )}
                  {app.nextStep && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md mt-2">
                      🎯 {app.nextStep}
                    </div>
                  )}
                </div>
              ))}
              
              {mockApplications.filter(a => a.status === col.id).length === 0 && (
                <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg h-24 flex items-center justify-center text-muted-foreground/50 text-sm font-medium">
                  Drop here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
