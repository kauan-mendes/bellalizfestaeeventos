const gallery = [...document.querySelectorAll('.photos a')];
const dialog = document.querySelector('dialog');
const photo = dialog.querySelector('img');
const caption = dialog.querySelector('#foto-legenda');
let current = 0;
let opener;

function showPhoto(index) {
  current = (index + gallery.length) % gallery.length;
  const link = gallery[current];
  photo.src = link.href;
  photo.alt = link.querySelector('img').alt;
  caption.textContent = link.querySelector('span').textContent;
}

gallery.forEach((link, index) => {
  link.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !dialog.showModal) return;
    event.preventDefault();
    opener = link;
    showPhoto(index);
    dialog.showModal();
  });
});

dialog.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.querySelector('.prev').addEventListener('click', () => showPhoto(current - 1));
dialog.querySelector('.next').addEventListener('click', () => showPhoto(current + 1));
dialog.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') showPhoto(current - 1);
  if (event.key === 'ArrowRight') showPhoto(current + 1);
});
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener('close', () => opener?.focus());
