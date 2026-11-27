# Bella Liz Festas & Eventos

Site estático. Para visualizar localmente, execute `python3 -m http.server 8000 --directory public` na raiz e abra http://localhost:8000.

No Render, conecte o repositório como **Static Site**. Se configurar manualmente, use `test -f public/index.html` como Build Command e `public` como Publish Directory. Se usar um Blueprint, o arquivo `render.yaml` já contém essas configurações.
