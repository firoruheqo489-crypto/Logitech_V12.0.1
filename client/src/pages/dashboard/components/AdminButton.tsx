import { Loader2, LockKeyhole, LogOut, Settings, ShieldCheck } from 'lucide-react';

interface AdminButtonProps {
  authenticated: boolean;
  configured: boolean;
  loading?: boolean;
  onLogin: () => void;
  onManage: () => void;
  onLogout: () => void;
}

export function AdminButton({
  authenticated,
  configured,
  loading = false,
  onLogin,
  onManage,
  onLogout,
}: AdminButtonProps) {
  const disabled = loading || (!authenticated && !configured);

  return (
    <div className="fixed bottom-6 right-6 z-[70] flex items-stretch overflow-hidden rounded-xl border border-white/[0.1] bg-[#080b10]/95 shadow-[0_18px_55px_rgba(0,0,0,0.48)] backdrop-blur-xl">
      <button
        type="button"
        onClick={authenticated ? onManage : onLogin}
        disabled={disabled}
        className="group flex min-h-[52px] items-center gap-3 px-4 py-2 text-left transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={authenticated ? '打开管理员数据管理' : '管理员登录'}
        title={authenticated ? '管理员数据管理' : configured ? '管理员登录' : '服务器未配置管理员密码'}
      >
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          authenticated ? 'bg-emerald-400/10 text-emerald-300' : 'bg-cyan-400/10 text-cyan-200'
        }`}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : authenticated ? (
            <ShieldCheck className="h-4 w-4" />
          ) : (
            <LockKeyhole className="h-4 w-4" />
          )}
        </span>
        <span>
          <span className="block text-xs font-semibold text-slate-100">
            {loading
              ? '权限检查中'
              : authenticated
                ? '管理员模式'
                : configured
                  ? '管理员登录'
                  : '只读模式'}
          </span>
          <span className="mt-0.5 block text-[10px] text-slate-500">
            {authenticated ? '拥有服务器修改权限' : configured ? '当前仅可查看数据' : '写入权限未配置'}
          </span>
        </span>
        {authenticated ? <Settings className="ml-1 h-3.5 w-3.5 text-slate-500 transition group-hover:rotate-45" /> : null}
      </button>

      {authenticated ? (
        <button
          type="button"
          onClick={onLogout}
          className="flex w-11 items-center justify-center border-l border-white/[0.08] text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-300"
          aria-label="退出管理员模式"
          title="退出管理员模式"
        >
          <LogOut className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
