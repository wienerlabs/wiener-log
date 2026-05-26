
using namespace System.Management.Automation
using namespace System.Management.Automation.Language

Register-ArgumentCompleter -Native -CommandName 'wlog' -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $commandElements = $commandAst.CommandElements
    $command = @(
        'wlog'
        for ($i = 1; $i -lt $commandElements.Count; $i++) {
            $element = $commandElements[$i]
            if ($element -isnot [StringConstantExpressionAst] -or
                $element.StringConstantType -ne [StringConstantType]::BareWord -or
                $element.Value.StartsWith('-') -or
                $element.Value -eq $wordToComplete) {
                break
        }
        $element.Value
    }) -join ';'

    $completions = @(switch ($command) {
        'wlog' {
            [CompletionResult]::new('--config', '--config', [CompletionResultType]::ParameterName, 'Path to an explicit config file (overrides discovery)')
            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help (see more with ''--help'')')
            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help (see more with ''--help'')')
            [CompletionResult]::new('-V', '-V ', [CompletionResultType]::ParameterName, 'Print version')
            [CompletionResult]::new('--version', '--version', [CompletionResultType]::ParameterName, 'Print version')
            [CompletionResult]::new('init', 'init', [CompletionResultType]::ParameterValue, 'Bootstrap a workspace: write config, run migrations, verify DB')
            [CompletionResult]::new('add', 'add', [CompletionResultType]::ParameterValue, 'Add a manual task')
            [CompletionResult]::new('ls', 'ls', [CompletionResultType]::ParameterValue, 'List tasks')
            [CompletionResult]::new('show', 'show', [CompletionResultType]::ParameterValue, 'Show a task with its edges')
            [CompletionResult]::new('ack', 'ack', [CompletionResultType]::ParameterValue, 'Acknowledge, edit, or reject a task')
            [CompletionResult]::new('hooks', 'hooks', [CompletionResultType]::ParameterValue, 'Manage repository git hooks')
            [CompletionResult]::new('daemon', 'daemon', [CompletionResultType]::ParameterValue, 'Run or inspect the long-lived ingestion coordinator')
            [CompletionResult]::new('cost', 'cost', [CompletionResultType]::ParameterValue, 'Inspect LLM spend recorded in the cost ledger')
            [CompletionResult]::new('completions', 'completions', [CompletionResultType]::ParameterValue, 'Print a shell completion script')
            [CompletionResult]::new('help', 'help', [CompletionResultType]::ParameterValue, 'Print this message or the help of the given subcommand(s)')
            break
        }
        'wlog;init' {
            [CompletionResult]::new('--slug', '--slug', [CompletionResultType]::ParameterName, 'URL-safe slug, defaults to current directory name')
            [CompletionResult]::new('--name', '--name', [CompletionResultType]::ParameterName, 'Human-readable name; defaults to the slug')
            [CompletionResult]::new('--user', '--user', [CompletionResultType]::ParameterName, 'Per-workspace handle for the current user')
            [CompletionResult]::new('--database-url', '--database-url', [CompletionResultType]::ParameterName, 'Postgres URL')
            [CompletionResult]::new('--config', '--config', [CompletionResultType]::ParameterName, 'Path to an explicit config file (overrides discovery)')
            [CompletionResult]::new('--force', '--force', [CompletionResultType]::ParameterName, 'Overwrite an existing config')
            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
            break
        }
        'wlog;add' {
            [CompletionResult]::new('--body', '--body', [CompletionResultType]::ParameterName, 'Optional body')
            [CompletionResult]::new('--repo', '--repo', [CompletionResultType]::ParameterName, 'Originating repository slug')
            [CompletionResult]::new('--node-type', '--node-type', [CompletionResultType]::ParameterName, 'Node type (intent, decomposition, execution, outcome)')
            [CompletionResult]::new('--config', '--config', [CompletionResultType]::ParameterName, 'Path to an explicit config file (overrides discovery)')
            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
            break
        }
        'wlog;ls' {
            [CompletionResult]::new('--status', '--status', [CompletionResultType]::ParameterName, 'Filter by status')
            [CompletionResult]::new('--repo', '--repo', [CompletionResultType]::ParameterName, 'Filter by repository')
            [CompletionResult]::new('--limit', '--limit', [CompletionResultType]::ParameterName, 'Maximum rows')
            [CompletionResult]::new('--format', '--format', [CompletionResultType]::ParameterName, 'Output format')
            [CompletionResult]::new('--config', '--config', [CompletionResultType]::ParameterName, 'Path to an explicit config file (overrides discovery)')
            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help (see more with ''--help'')')
            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help (see more with ''--help'')')
            break
        }
        'wlog;show' {
            [CompletionResult]::new('--format', '--format', [CompletionResultType]::ParameterName, 'Output format')
            [CompletionResult]::new('--config', '--config', [CompletionResultType]::ParameterName, 'Path to an explicit config file (overrides discovery)')
            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help (see more with ''--help'')')
            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help (see more with ''--help'')')
            break
        }
        'wlog;ack' {
            [CompletionResult]::new('--reason', '--reason', [CompletionResultType]::ParameterName, 'Reason for rejection')
            [CompletionResult]::new('--config', '--config', [CompletionResultType]::ParameterName, 'Path to an explicit config file (overrides discovery)')
            [CompletionResult]::new('--edit', '--edit', [CompletionResultType]::ParameterName, 'Open `$EDITOR` to update title and body before ack')
            [CompletionResult]::new('--reject', '--reject', [CompletionResultType]::ParameterName, 'Reject the task instead of acking')
            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
            break
        }
        'wlog;hooks' {
            [CompletionResult]::new('--config', '--config', [CompletionResultType]::ParameterName, 'Path to an explicit config file (overrides discovery)')
            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
            [CompletionResult]::new('install', 'install', [CompletionResultType]::ParameterValue, 'Install wlog-managed hooks (post-commit, post-merge, pre-push)')
            [CompletionResult]::new('uninstall', 'uninstall', [CompletionResultType]::ParameterValue, 'Remove wlog-managed hooks; foreign hooks are left untouched')
            [CompletionResult]::new('status', 'status', [CompletionResultType]::ParameterValue, 'Report which hooks are currently managed by wlog')
            [CompletionResult]::new('notify', 'notify', [CompletionResultType]::ParameterValue, 'Internal: hook scripts invoke this to forward an event to the daemon socket. Phase 1 implements the publisher; today this only logs and exits 0 so the hook never fails the user''s commit')
            [CompletionResult]::new('help', 'help', [CompletionResultType]::ParameterValue, 'Print this message or the help of the given subcommand(s)')
            break
        }
        'wlog;hooks;install' {
            [CompletionResult]::new('--repo', '--repo', [CompletionResultType]::ParameterName, 'Repository root (defaults to current working directory)')
            [CompletionResult]::new('--config', '--config', [CompletionResultType]::ParameterName, 'Path to an explicit config file (overrides discovery)')
            [CompletionResult]::new('--force', '--force', [CompletionResultType]::ParameterName, 'Overwrite hooks that wlog did not write')
            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
            break
        }
        'wlog;hooks;uninstall' {
            [CompletionResult]::new('--repo', '--repo', [CompletionResultType]::ParameterName, 'Repository root')
            [CompletionResult]::new('--config', '--config', [CompletionResultType]::ParameterName, 'Path to an explicit config file (overrides discovery)')
            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
            break
        }
        'wlog;hooks;status' {
            [CompletionResult]::new('--repo', '--repo', [CompletionResultType]::ParameterName, 'Repository root')
            [CompletionResult]::new('--config', '--config', [CompletionResultType]::ParameterName, 'Path to an explicit config file (overrides discovery)')
            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
            break
        }
        'wlog;hooks;notify' {
            [CompletionResult]::new('--config', '--config', [CompletionResultType]::ParameterName, 'Path to an explicit config file (overrides discovery)')
            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
            break
        }
        'wlog;hooks;help' {
            [CompletionResult]::new('install', 'install', [CompletionResultType]::ParameterValue, 'Install wlog-managed hooks (post-commit, post-merge, pre-push)')
            [CompletionResult]::new('uninstall', 'uninstall', [CompletionResultType]::ParameterValue, 'Remove wlog-managed hooks; foreign hooks are left untouched')
            [CompletionResult]::new('status', 'status', [CompletionResultType]::ParameterValue, 'Report which hooks are currently managed by wlog')
            [CompletionResult]::new('notify', 'notify', [CompletionResultType]::ParameterValue, 'Internal: hook scripts invoke this to forward an event to the daemon socket. Phase 1 implements the publisher; today this only logs and exits 0 so the hook never fails the user''s commit')
            [CompletionResult]::new('help', 'help', [CompletionResultType]::ParameterValue, 'Print this message or the help of the given subcommand(s)')
            break
        }
        'wlog;hooks;help;install' {
            break
        }
        'wlog;hooks;help;uninstall' {
            break
        }
        'wlog;hooks;help;status' {
            break
        }
        'wlog;hooks;help;notify' {
            break
        }
        'wlog;hooks;help;help' {
            break
        }
        'wlog;daemon' {
            [CompletionResult]::new('--config', '--config', [CompletionResultType]::ParameterName, 'Path to an explicit config file (overrides discovery)')
            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
            [CompletionResult]::new('run', 'run', [CompletionResultType]::ParameterValue, 'Run the daemon in the foreground until Ctrl-C')
            [CompletionResult]::new('status', 'status', [CompletionResultType]::ParameterValue, 'Print whether a daemon socket currently exists')
            [CompletionResult]::new('help', 'help', [CompletionResultType]::ParameterValue, 'Print this message or the help of the given subcommand(s)')
            break
        }
        'wlog;daemon;run' {
            [CompletionResult]::new('--socket', '--socket', [CompletionResultType]::ParameterName, 'Override the default socket path (XDG_RUNTIME_DIR/wlog.sock)')
            [CompletionResult]::new('--nats-url', '--nats-url', [CompletionResultType]::ParameterName, 'NATS URL; if unset the daemon just logs incoming payloads')
            [CompletionResult]::new('--cc-projects-dir', '--cc-projects-dir', [CompletionResultType]::ParameterName, 'Path to `~/.claude/projects/` to watch. Unset disables the CC worker. Pass `--cc-projects-dir auto` to use the default')
            [CompletionResult]::new('--cc-cursor', '--cc-cursor', [CompletionResultType]::ParameterName, 'Override the CC cursor location')
            [CompletionResult]::new('--config', '--config', [CompletionResultType]::ParameterName, 'Path to an explicit config file (overrides discovery)')
            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
            break
        }
        'wlog;daemon;status' {
            [CompletionResult]::new('--socket', '--socket', [CompletionResultType]::ParameterName, 'Override the default socket path')
            [CompletionResult]::new('--config', '--config', [CompletionResultType]::ParameterName, 'Path to an explicit config file (overrides discovery)')
            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
            break
        }
        'wlog;daemon;help' {
            [CompletionResult]::new('run', 'run', [CompletionResultType]::ParameterValue, 'Run the daemon in the foreground until Ctrl-C')
            [CompletionResult]::new('status', 'status', [CompletionResultType]::ParameterValue, 'Print whether a daemon socket currently exists')
            [CompletionResult]::new('help', 'help', [CompletionResultType]::ParameterValue, 'Print this message or the help of the given subcommand(s)')
            break
        }
        'wlog;daemon;help;run' {
            break
        }
        'wlog;daemon;help;status' {
            break
        }
        'wlog;daemon;help;help' {
            break
        }
        'wlog;cost' {
            [CompletionResult]::new('--days', '--days', [CompletionResultType]::ParameterName, 'Number of days to summarize (inclusive of today, UTC)')
            [CompletionResult]::new('--reports-dir', '--reports-dir', [CompletionResultType]::ParameterName, 'Ledger root; defaults to `<cwd>/reports/cost`')
            [CompletionResult]::new('--config', '--config', [CompletionResultType]::ParameterName, 'Path to an explicit config file (overrides discovery)')
            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
            break
        }
        'wlog;completions' {
            [CompletionResult]::new('--config', '--config', [CompletionResultType]::ParameterName, 'Path to an explicit config file (overrides discovery)')
            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
            break
        }
        'wlog;help' {
            [CompletionResult]::new('init', 'init', [CompletionResultType]::ParameterValue, 'Bootstrap a workspace: write config, run migrations, verify DB')
            [CompletionResult]::new('add', 'add', [CompletionResultType]::ParameterValue, 'Add a manual task')
            [CompletionResult]::new('ls', 'ls', [CompletionResultType]::ParameterValue, 'List tasks')
            [CompletionResult]::new('show', 'show', [CompletionResultType]::ParameterValue, 'Show a task with its edges')
            [CompletionResult]::new('ack', 'ack', [CompletionResultType]::ParameterValue, 'Acknowledge, edit, or reject a task')
            [CompletionResult]::new('hooks', 'hooks', [CompletionResultType]::ParameterValue, 'Manage repository git hooks')
            [CompletionResult]::new('daemon', 'daemon', [CompletionResultType]::ParameterValue, 'Run or inspect the long-lived ingestion coordinator')
            [CompletionResult]::new('cost', 'cost', [CompletionResultType]::ParameterValue, 'Inspect LLM spend recorded in the cost ledger')
            [CompletionResult]::new('completions', 'completions', [CompletionResultType]::ParameterValue, 'Print a shell completion script')
            [CompletionResult]::new('help', 'help', [CompletionResultType]::ParameterValue, 'Print this message or the help of the given subcommand(s)')
            break
        }
        'wlog;help;init' {
            break
        }
        'wlog;help;add' {
            break
        }
        'wlog;help;ls' {
            break
        }
        'wlog;help;show' {
            break
        }
        'wlog;help;ack' {
            break
        }
        'wlog;help;hooks' {
            [CompletionResult]::new('install', 'install', [CompletionResultType]::ParameterValue, 'Install wlog-managed hooks (post-commit, post-merge, pre-push)')
            [CompletionResult]::new('uninstall', 'uninstall', [CompletionResultType]::ParameterValue, 'Remove wlog-managed hooks; foreign hooks are left untouched')
            [CompletionResult]::new('status', 'status', [CompletionResultType]::ParameterValue, 'Report which hooks are currently managed by wlog')
            [CompletionResult]::new('notify', 'notify', [CompletionResultType]::ParameterValue, 'Internal: hook scripts invoke this to forward an event to the daemon socket. Phase 1 implements the publisher; today this only logs and exits 0 so the hook never fails the user''s commit')
            break
        }
        'wlog;help;hooks;install' {
            break
        }
        'wlog;help;hooks;uninstall' {
            break
        }
        'wlog;help;hooks;status' {
            break
        }
        'wlog;help;hooks;notify' {
            break
        }
        'wlog;help;daemon' {
            [CompletionResult]::new('run', 'run', [CompletionResultType]::ParameterValue, 'Run the daemon in the foreground until Ctrl-C')
            [CompletionResult]::new('status', 'status', [CompletionResultType]::ParameterValue, 'Print whether a daemon socket currently exists')
            break
        }
        'wlog;help;daemon;run' {
            break
        }
        'wlog;help;daemon;status' {
            break
        }
        'wlog;help;cost' {
            break
        }
        'wlog;help;completions' {
            break
        }
        'wlog;help;help' {
            break
        }
    })

    $completions.Where{ $_.CompletionText -like "$wordToComplete*" } |
        Sort-Object -Property ListItemText
}
