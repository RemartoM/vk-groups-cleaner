/**
 * VK Groups Cleaner — Этап 1: сбор списка сообществ.
 *
 * Запуск: открыть vk.com/groups, открыть DevTools (F12) → Console,
 * вставить этот код целиком, нажать Enter.
 *
 * Скрипт прокручивает страницу до конца (ВК подгружает сообщества
 * лениво, по мере прокрутки), собирает id/name/href каждой группы
 * и скачивает результат в my_groups.csv.
 */

(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  console.log('Загружаю все сообщества...');

  const seen = new Map();
  let lastHeight = 0;
  let stable = 0;

  // Прокручиваем, пока высота страницы не перестанет меняться
  // три итерации подряд — значит, всё подгрузилось.
  while (stable < 3) {
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(1500);

    document.querySelectorAll('[class*="vkuiRichCell__host"]').forEach(cell => {
      const id = cell.getAttribute('data-id');
      if (id && !seen.has(id)) {
        seen.set(id, {
          id,
          name: (cell.getAttribute('aria-label') || '').trim(),
          href: cell.getAttribute('href') ? cell.getAttribute('href').split('?')[0] : '',
          keep: ''
        });
      }
    });

    const h = document.body.scrollHeight;
    if (h === lastHeight) stable++;
    else { stable = 0; lastHeight = h; }

    console.log(`  высота: ${h}, собрано: ${seen.size}`);
  }

  window.scrollTo(0, 0);
  await sleep(500);

  const groups = [...seen.values()];
  console.log(`Всего сообществ: ${groups.length}`);
  console.table(groups);

  // Формируем CSV вручную: разделитель ";", BOM для корректной
  // кириллицы в Excel, экранирование кавычками.
  const headers = ['id', 'name', 'href', 'keep'];
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.join(';'),
    ...groups.map(r => headers.map(h => escape(r[h])).join(';'))
  ];
  const csv = lines.join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my_groups.csv';
  a.click();
  URL.revokeObjectURL(url);

  console.log('Файл my_groups.csv сохранён.');
})();