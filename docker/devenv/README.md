Kurze Anleitung

1. Installiere VSCode mit der [Dev Container Extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. Verwende ein Bootstrapper Script 

Der Bequemste Weg (Achtung; Code wird direkt in die Shell übergeben):
Linux:
```bash
curl XXX | bash -s -- --repo 'https://github.com/mspark/rdplan-web-next' --volume selflearn-dev-repository -f docker/devenv/compose-dev.yaml  
```

Windows: 
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force; powershell -Command "& { $(Invoke-RestMethod -Uri 'https://example.com/script.ps1') -repo 'https://github.com/e-learning-by-sse/nm-self-learning' -volume 'selflearn-dev-respository' -f 'docker/devenv/compose-dev.yaml' }"
```

3. Starte in VSCode den Commandprompt (F1) und wähle "Dev Containers: Attach to running containers" und wähle denn
