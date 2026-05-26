# Print an optspec for argparse to handle cmd's options that are independent of any subcommand.
function __fish_wlog_global_optspecs
	string join \n config= h/help V/version
end

function __fish_wlog_needs_command
	# Figure out if the current invocation already has a command.
	set -l cmd (commandline -opc)
	set -e cmd[1]
	argparse -s (__fish_wlog_global_optspecs) -- $cmd 2>/dev/null
	or return
	if set -q argv[1]
		# Also print the command, so this can be used to figure out what it is.
		echo $argv[1]
		return 1
	end
	return 0
end

function __fish_wlog_using_subcommand
	set -l cmd (__fish_wlog_needs_command)
	test -z "$cmd"
	and return 1
	contains -- $cmd[1] $argv
end

complete -c wlog -n "__fish_wlog_needs_command" -l config -d 'Path to an explicit config file (overrides discovery)' -r -F
complete -c wlog -n "__fish_wlog_needs_command" -s h -l help -d 'Print help (see more with \'--help\')'
complete -c wlog -n "__fish_wlog_needs_command" -s V -l version -d 'Print version'
complete -c wlog -n "__fish_wlog_needs_command" -f -a "init" -d 'Bootstrap a workspace: write config, run migrations, verify DB'
complete -c wlog -n "__fish_wlog_needs_command" -f -a "add" -d 'Add a manual task'
complete -c wlog -n "__fish_wlog_needs_command" -f -a "ls" -d 'List tasks'
complete -c wlog -n "__fish_wlog_needs_command" -f -a "show" -d 'Show a task with its edges'
complete -c wlog -n "__fish_wlog_needs_command" -f -a "ack" -d 'Acknowledge, edit, or reject a task'
complete -c wlog -n "__fish_wlog_needs_command" -f -a "hooks" -d 'Manage repository git hooks'
complete -c wlog -n "__fish_wlog_needs_command" -f -a "completions" -d 'Print a shell completion script'
complete -c wlog -n "__fish_wlog_needs_command" -f -a "help" -d 'Print this message or the help of the given subcommand(s)'
complete -c wlog -n "__fish_wlog_using_subcommand init" -l slug -d 'URL-safe slug, defaults to current directory name' -r
complete -c wlog -n "__fish_wlog_using_subcommand init" -l name -d 'Human-readable name; defaults to the slug' -r
complete -c wlog -n "__fish_wlog_using_subcommand init" -l user -d 'Per-workspace handle for the current user' -r
complete -c wlog -n "__fish_wlog_using_subcommand init" -l database-url -d 'Postgres URL' -r
complete -c wlog -n "__fish_wlog_using_subcommand init" -l config -d 'Path to an explicit config file (overrides discovery)' -r -F
complete -c wlog -n "__fish_wlog_using_subcommand init" -l force -d 'Overwrite an existing config'
complete -c wlog -n "__fish_wlog_using_subcommand init" -s h -l help -d 'Print help'
complete -c wlog -n "__fish_wlog_using_subcommand add" -l body -d 'Optional body' -r
complete -c wlog -n "__fish_wlog_using_subcommand add" -l repo -d 'Originating repository slug' -r
complete -c wlog -n "__fish_wlog_using_subcommand add" -l node-type -d 'Node type (intent, decomposition, execution, outcome)' -r
complete -c wlog -n "__fish_wlog_using_subcommand add" -l config -d 'Path to an explicit config file (overrides discovery)' -r -F
complete -c wlog -n "__fish_wlog_using_subcommand add" -s h -l help -d 'Print help'
complete -c wlog -n "__fish_wlog_using_subcommand ls" -l status -d 'Filter by status' -r
complete -c wlog -n "__fish_wlog_using_subcommand ls" -l repo -d 'Filter by repository' -r
complete -c wlog -n "__fish_wlog_using_subcommand ls" -l limit -d 'Maximum rows' -r
complete -c wlog -n "__fish_wlog_using_subcommand ls" -l format -d 'Output format' -r -f -a "table\t'Plain text table for human reading'
json\t'One JSON object per line'
tsv\t'Tab-separated values for spreadsheet paste'"
complete -c wlog -n "__fish_wlog_using_subcommand ls" -l config -d 'Path to an explicit config file (overrides discovery)' -r -F
complete -c wlog -n "__fish_wlog_using_subcommand ls" -s h -l help -d 'Print help (see more with \'--help\')'
complete -c wlog -n "__fish_wlog_using_subcommand show" -l format -d 'Output format' -r -f -a "table\t'Plain text table for human reading'
json\t'One JSON object per line'
tsv\t'Tab-separated values for spreadsheet paste'"
complete -c wlog -n "__fish_wlog_using_subcommand show" -l config -d 'Path to an explicit config file (overrides discovery)' -r -F
complete -c wlog -n "__fish_wlog_using_subcommand show" -s h -l help -d 'Print help (see more with \'--help\')'
complete -c wlog -n "__fish_wlog_using_subcommand ack" -l reason -d 'Reason for rejection' -r
complete -c wlog -n "__fish_wlog_using_subcommand ack" -l config -d 'Path to an explicit config file (overrides discovery)' -r -F
complete -c wlog -n "__fish_wlog_using_subcommand ack" -l edit -d 'Open `$EDITOR` to update title and body before ack'
complete -c wlog -n "__fish_wlog_using_subcommand ack" -l reject -d 'Reject the task instead of acking'
complete -c wlog -n "__fish_wlog_using_subcommand ack" -s h -l help -d 'Print help'
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and not __fish_seen_subcommand_from install uninstall status notify help" -l config -d 'Path to an explicit config file (overrides discovery)' -r -F
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and not __fish_seen_subcommand_from install uninstall status notify help" -s h -l help -d 'Print help'
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and not __fish_seen_subcommand_from install uninstall status notify help" -f -a "install" -d 'Install wlog-managed hooks (post-commit, post-merge, pre-push)'
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and not __fish_seen_subcommand_from install uninstall status notify help" -f -a "uninstall" -d 'Remove wlog-managed hooks; foreign hooks are left untouched'
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and not __fish_seen_subcommand_from install uninstall status notify help" -f -a "status" -d 'Report which hooks are currently managed by wlog'
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and not __fish_seen_subcommand_from install uninstall status notify help" -f -a "notify" -d 'Internal: hook scripts invoke this to forward an event to the daemon socket. Phase 1 implements the publisher; today this only logs and exits 0 so the hook never fails the user\'s commit'
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and not __fish_seen_subcommand_from install uninstall status notify help" -f -a "help" -d 'Print this message or the help of the given subcommand(s)'
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and __fish_seen_subcommand_from install" -l repo -d 'Repository root (defaults to current working directory)' -r -F
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and __fish_seen_subcommand_from install" -l config -d 'Path to an explicit config file (overrides discovery)' -r -F
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and __fish_seen_subcommand_from install" -l force -d 'Overwrite hooks that wlog did not write'
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and __fish_seen_subcommand_from install" -s h -l help -d 'Print help'
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and __fish_seen_subcommand_from uninstall" -l repo -d 'Repository root' -r -F
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and __fish_seen_subcommand_from uninstall" -l config -d 'Path to an explicit config file (overrides discovery)' -r -F
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and __fish_seen_subcommand_from uninstall" -s h -l help -d 'Print help'
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and __fish_seen_subcommand_from status" -l repo -d 'Repository root' -r -F
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and __fish_seen_subcommand_from status" -l config -d 'Path to an explicit config file (overrides discovery)' -r -F
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and __fish_seen_subcommand_from status" -s h -l help -d 'Print help'
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and __fish_seen_subcommand_from notify" -l config -d 'Path to an explicit config file (overrides discovery)' -r -F
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and __fish_seen_subcommand_from notify" -s h -l help -d 'Print help'
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and __fish_seen_subcommand_from help" -f -a "install" -d 'Install wlog-managed hooks (post-commit, post-merge, pre-push)'
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and __fish_seen_subcommand_from help" -f -a "uninstall" -d 'Remove wlog-managed hooks; foreign hooks are left untouched'
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and __fish_seen_subcommand_from help" -f -a "status" -d 'Report which hooks are currently managed by wlog'
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and __fish_seen_subcommand_from help" -f -a "notify" -d 'Internal: hook scripts invoke this to forward an event to the daemon socket. Phase 1 implements the publisher; today this only logs and exits 0 so the hook never fails the user\'s commit'
complete -c wlog -n "__fish_wlog_using_subcommand hooks; and __fish_seen_subcommand_from help" -f -a "help" -d 'Print this message or the help of the given subcommand(s)'
complete -c wlog -n "__fish_wlog_using_subcommand completions" -l config -d 'Path to an explicit config file (overrides discovery)' -r -F
complete -c wlog -n "__fish_wlog_using_subcommand completions" -s h -l help -d 'Print help'
complete -c wlog -n "__fish_wlog_using_subcommand help; and not __fish_seen_subcommand_from init add ls show ack hooks completions help" -f -a "init" -d 'Bootstrap a workspace: write config, run migrations, verify DB'
complete -c wlog -n "__fish_wlog_using_subcommand help; and not __fish_seen_subcommand_from init add ls show ack hooks completions help" -f -a "add" -d 'Add a manual task'
complete -c wlog -n "__fish_wlog_using_subcommand help; and not __fish_seen_subcommand_from init add ls show ack hooks completions help" -f -a "ls" -d 'List tasks'
complete -c wlog -n "__fish_wlog_using_subcommand help; and not __fish_seen_subcommand_from init add ls show ack hooks completions help" -f -a "show" -d 'Show a task with its edges'
complete -c wlog -n "__fish_wlog_using_subcommand help; and not __fish_seen_subcommand_from init add ls show ack hooks completions help" -f -a "ack" -d 'Acknowledge, edit, or reject a task'
complete -c wlog -n "__fish_wlog_using_subcommand help; and not __fish_seen_subcommand_from init add ls show ack hooks completions help" -f -a "hooks" -d 'Manage repository git hooks'
complete -c wlog -n "__fish_wlog_using_subcommand help; and not __fish_seen_subcommand_from init add ls show ack hooks completions help" -f -a "completions" -d 'Print a shell completion script'
complete -c wlog -n "__fish_wlog_using_subcommand help; and not __fish_seen_subcommand_from init add ls show ack hooks completions help" -f -a "help" -d 'Print this message or the help of the given subcommand(s)'
complete -c wlog -n "__fish_wlog_using_subcommand help; and __fish_seen_subcommand_from hooks" -f -a "install" -d 'Install wlog-managed hooks (post-commit, post-merge, pre-push)'
complete -c wlog -n "__fish_wlog_using_subcommand help; and __fish_seen_subcommand_from hooks" -f -a "uninstall" -d 'Remove wlog-managed hooks; foreign hooks are left untouched'
complete -c wlog -n "__fish_wlog_using_subcommand help; and __fish_seen_subcommand_from hooks" -f -a "status" -d 'Report which hooks are currently managed by wlog'
complete -c wlog -n "__fish_wlog_using_subcommand help; and __fish_seen_subcommand_from hooks" -f -a "notify" -d 'Internal: hook scripts invoke this to forward an event to the daemon socket. Phase 1 implements the publisher; today this only logs and exits 0 so the hook never fails the user\'s commit'
