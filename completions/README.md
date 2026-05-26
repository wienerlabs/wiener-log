# Shell completions

Pre-generated completion scripts for the `wlog` command. They are
committed (rather than generated at install time) so that operating
without a Rust toolchain still works.

Regenerate after any CLI surface change:

```bash
wlog completions bash       > completions/wlog.bash
wlog completions zsh        > completions/_wlog
wlog completions fish       > completions/wlog.fish
wlog completions powershell > completions/_wlog.ps1
wlog completions elvish     > completions/wlog.elv
```

## Install

### Bash

```bash
sudo install -m 0644 completions/wlog.bash /etc/bash_completion.d/wlog
# or, user-local:
mkdir -p ~/.local/share/bash-completion/completions
install -m 0644 completions/wlog.bash ~/.local/share/bash-completion/completions/wlog
```

### Zsh

Place `_wlog` somewhere in `$fpath` (e.g. `/usr/local/share/zsh/site-functions`
or `~/.zsh/completions`) and reload:

```bash
mkdir -p ~/.zsh/completions
install -m 0644 completions/_wlog ~/.zsh/completions/_wlog
# Ensure ~/.zshrc contains: fpath=(~/.zsh/completions $fpath)
autoload -Uz compinit && compinit
```

### Fish

```bash
mkdir -p ~/.config/fish/completions
install -m 0644 completions/wlog.fish ~/.config/fish/completions/wlog.fish
```

### PowerShell

```powershell
. ./completions/_wlog.ps1
```

Add to your profile (`$PROFILE`) to make it permanent.

### Elvish

```bash
mkdir -p ~/.config/elvish/lib
install -m 0644 completions/wlog.elv ~/.config/elvish/lib/wlog.elv
echo "use wlog" >> ~/.config/elvish/rc.elv
```
