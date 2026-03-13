{ pkgs, lib, config, inputs, ... }:

{
  # 1. Enable Node.js for modern JS tooling
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_20; # Use an LTS version
    pnpm.enable = true;      # Cleaner and faster than npm
  };
  languages.python = {
    enable = true;
    venv.enable = true;
    venv.requirements = ''
      PyYAML
      pydantic
    '';
  };

  # Startet den Editor-Server automatisch bei 'devenv up'
  processes.editor-server.exec = "python server.py";

  # Sorgt dafür, dass der Linter-Pfad im PYTHONPATH ist
  env.PYTHONPATH = "./lx-data-models";

  # 2. Useful packages for a "No-Build" feel
  packages = [ 
    pkgs.git 
    pkgs.nodePackages.typescript-language-server # Even for JS, helps with autocomplete

  ];

  # 3. Automation scripts
  scripts.dev.exec = "pnpm dlx vite"; # Runs a dev server instantly without global install
  scripts.build.exec = "pnpm dlx vite build";

  enterShell = ''
    echo "🚀 ES6 Development Environment Ready"
    node --version
    pnpm --version
    echo "Type 'dev' to start a local dev server with Vite."
  '';
}
