(() => {
  const key = 'bella-liz-aviso-locacao';
  try {
    if (sessionStorage.getItem(key)) return;
  } catch {
    // Storage can be unavailable in some browsers.
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'rental-notice';
  dialog.setAttribute('aria-labelledby', 'rental-notice-title');
  dialog.setAttribute('aria-describedby', 'rental-notice-description');
  dialog.innerHTML = `
    <h2 id="rental-notice-title">Aviso sobre locação</h2>
    <p id="rental-notice-description">Não alugamos o espaço para pancadão, fluxo ou bagunças.</p>
    <form method="dialog"><button class="button lime" autofocus>Entendi</button></form>
  `;
  dialog.addEventListener('close', () => {
    try {
      sessionStorage.setItem(key, 'seen');
    } catch {
      // The notice can still be dismissed.
    }
    dialog.remove();
  }, {once:true});
  document.body.append(dialog);
  dialog.showModal();
})();
