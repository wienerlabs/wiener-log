
use builtin;
use str;

set edit:completion:arg-completer[wlog] = {|@words|
    fn spaces {|n|
        builtin:repeat $n ' ' | str:join ''
    }
    fn cand {|text desc|
        edit:complex-candidate $text &display=$text' '(spaces (- 14 (wcswidth $text)))$desc
    }
    var command = 'wlog'
    for word $words[1..-1] {
        if (str:has-prefix $word '-') {
            break
        }
        set command = $command';'$word
    }
    var completions = [
        &'wlog'= {
            cand --config 'Path to an explicit config file (overrides discovery)'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand init 'Bootstrap a workspace: write config, run migrations, verify DB'
            cand add 'Add a manual task'
            cand ls 'List tasks'
            cand show 'Show a task with its edges'
            cand ack 'Acknowledge, edit, or reject a task'
            cand hooks 'Manage repository git hooks'
            cand completions 'Print a shell completion script'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'wlog;init'= {
            cand --slug 'URL-safe slug, defaults to current directory name'
            cand --name 'Human-readable name; defaults to the slug'
            cand --user 'Per-workspace handle for the current user'
            cand --database-url 'Postgres URL'
            cand --config 'Path to an explicit config file (overrides discovery)'
            cand --force 'Overwrite an existing config'
            cand -h 'Print help'
            cand --help 'Print help'
        }
        &'wlog;add'= {
            cand --body 'Optional body'
            cand --repo 'Originating repository slug'
            cand --node-type 'Node type (intent, decomposition, execution, outcome)'
            cand --config 'Path to an explicit config file (overrides discovery)'
            cand -h 'Print help'
            cand --help 'Print help'
        }
        &'wlog;ls'= {
            cand --status 'Filter by status'
            cand --repo 'Filter by repository'
            cand --limit 'Maximum rows'
            cand --format 'Output format'
            cand --config 'Path to an explicit config file (overrides discovery)'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
        }
        &'wlog;show'= {
            cand --format 'Output format'
            cand --config 'Path to an explicit config file (overrides discovery)'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
        }
        &'wlog;ack'= {
            cand --reason 'Reason for rejection'
            cand --config 'Path to an explicit config file (overrides discovery)'
            cand --edit 'Open `$EDITOR` to update title and body before ack'
            cand --reject 'Reject the task instead of acking'
            cand -h 'Print help'
            cand --help 'Print help'
        }
        &'wlog;hooks'= {
            cand --config 'Path to an explicit config file (overrides discovery)'
            cand -h 'Print help'
            cand --help 'Print help'
            cand install 'Install wlog-managed hooks (post-commit, post-merge, pre-push)'
            cand uninstall 'Remove wlog-managed hooks; foreign hooks are left untouched'
            cand status 'Report which hooks are currently managed by wlog'
            cand notify 'Internal: hook scripts invoke this to forward an event to the daemon socket. Phase 1 implements the publisher; today this only logs and exits 0 so the hook never fails the user''s commit'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'wlog;hooks;install'= {
            cand --repo 'Repository root (defaults to current working directory)'
            cand --config 'Path to an explicit config file (overrides discovery)'
            cand --force 'Overwrite hooks that wlog did not write'
            cand -h 'Print help'
            cand --help 'Print help'
        }
        &'wlog;hooks;uninstall'= {
            cand --repo 'Repository root'
            cand --config 'Path to an explicit config file (overrides discovery)'
            cand -h 'Print help'
            cand --help 'Print help'
        }
        &'wlog;hooks;status'= {
            cand --repo 'Repository root'
            cand --config 'Path to an explicit config file (overrides discovery)'
            cand -h 'Print help'
            cand --help 'Print help'
        }
        &'wlog;hooks;notify'= {
            cand --config 'Path to an explicit config file (overrides discovery)'
            cand -h 'Print help'
            cand --help 'Print help'
        }
        &'wlog;hooks;help'= {
            cand install 'Install wlog-managed hooks (post-commit, post-merge, pre-push)'
            cand uninstall 'Remove wlog-managed hooks; foreign hooks are left untouched'
            cand status 'Report which hooks are currently managed by wlog'
            cand notify 'Internal: hook scripts invoke this to forward an event to the daemon socket. Phase 1 implements the publisher; today this only logs and exits 0 so the hook never fails the user''s commit'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'wlog;hooks;help;install'= {
        }
        &'wlog;hooks;help;uninstall'= {
        }
        &'wlog;hooks;help;status'= {
        }
        &'wlog;hooks;help;notify'= {
        }
        &'wlog;hooks;help;help'= {
        }
        &'wlog;completions'= {
            cand --config 'Path to an explicit config file (overrides discovery)'
            cand -h 'Print help'
            cand --help 'Print help'
        }
        &'wlog;help'= {
            cand init 'Bootstrap a workspace: write config, run migrations, verify DB'
            cand add 'Add a manual task'
            cand ls 'List tasks'
            cand show 'Show a task with its edges'
            cand ack 'Acknowledge, edit, or reject a task'
            cand hooks 'Manage repository git hooks'
            cand completions 'Print a shell completion script'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'wlog;help;init'= {
        }
        &'wlog;help;add'= {
        }
        &'wlog;help;ls'= {
        }
        &'wlog;help;show'= {
        }
        &'wlog;help;ack'= {
        }
        &'wlog;help;hooks'= {
            cand install 'Install wlog-managed hooks (post-commit, post-merge, pre-push)'
            cand uninstall 'Remove wlog-managed hooks; foreign hooks are left untouched'
            cand status 'Report which hooks are currently managed by wlog'
            cand notify 'Internal: hook scripts invoke this to forward an event to the daemon socket. Phase 1 implements the publisher; today this only logs and exits 0 so the hook never fails the user''s commit'
        }
        &'wlog;help;hooks;install'= {
        }
        &'wlog;help;hooks;uninstall'= {
        }
        &'wlog;help;hooks;status'= {
        }
        &'wlog;help;hooks;notify'= {
        }
        &'wlog;help;completions'= {
        }
        &'wlog;help;help'= {
        }
    ]
    $completions[$command]
}
