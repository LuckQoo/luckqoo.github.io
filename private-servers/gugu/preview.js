'use strict';
// Public announcement page: no requests to membership or commerce APIs.
document.querySelectorAll('[data-news-filter]').forEach(button => {
  button.addEventListener('click', () => {
    const filter = button.dataset.newsFilter;
    document.querySelectorAll('[data-news-filter]').forEach(item => {
      item.classList.toggle('selected', item === button);
    });
    document.querySelectorAll('[data-news-type]').forEach(item => {
      item.style.display = filter === 'all' || item.dataset.newsType === filter ? '' : 'none';
    });
  });
});
