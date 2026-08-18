---
name: preview-visual-do-frontend
description: Como ver/screenshotar telas do frontend sem depender do usuario — Chrome headless, porta 5173 ocupada e o viewport minimo de 512px
metadata:
  type: project
---

Dá para conferir visualmente uma tela sozinho, sem pedir print ao usuário: `& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=8000 --window-size=1440,900 --screenshot=<saida.png> http://localhost/<rota>`.

**Why:** rebuildar o container só para o usuário descrever o resultado é lento; o screenshot fecha o ciclo de design na hora.

**How to apply:**
- Para iterar rápido, suba o dev server em vez de rebuildar: `npx vite --port 5199 --strictPort`. **A porta 5173 já está ocupada por outro projeto** (FTEC/vitrine) e o vite ainda anuncia "5173" mesmo servindo o app errado — sempre fixe outra porta e confirme com `curl -s http://localhost:<porta>/ | Select-String Quiron`.
- **Screenshot estreito não funciona**: o Chrome no Windows trava o viewport em ~512 CSS px, então `--window-size=390,844` gera uma imagem de 390 px de um layout de 512 px — parece overflow horizontal, mas é só corte da imagem. Para verificar overflow de verdade, injete temporariamente no `index.html` um script que imprima `document.documentElement.scrollWidth` vs `clientWidth` (iguais = sem overflow) e liste elementos mais largos que o viewport.
- Rotas protegidas redirecionam para `/login`; só dá para fotografar as públicas (`/login`, `/forgot-password`, `/reset-password?token=x`) sem sessão.
- Depois do build final, ver [[sempre-rebuild-e-restart]].
