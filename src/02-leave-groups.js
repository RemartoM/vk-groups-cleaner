/**
 * VK Groups Cleaner — Этап 2: выход из помеченных сообществ.
 *
 * Запуск: открыть vk.com/groups, открыть DevTools (F12) → Console,
 * вставить этот код целиком, нажать Enter, выбрать CSV-файл
 * с разметкой (плюс в колонке keep = выйти).
 *
 * Скрипт прокручивает страницу, собирает карточки сообществ,
 * для каждой помеченной группы открывает меню (через mouseover —
 * в новой вёрстке ВК меню открывается по наведению) и кликает
 * пункт «Отписаться».
 */

(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Настройки задержек. Уменьшать не стоит: слишком частые
  // однотипные действия ВК может расценить как автоматизацию.
  const DELAY_AFTER_HOVER = 1000;
  const DELAY_BETWEEN = 2500;

  // ---------- Выбор файла ----------
  const file = await new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = () => resolve(input.files[0]);
    input.click();
  });

  if (!file) {
    console.log('Файл не выбран.');
    return;
  }

  const text = await file.text();

  // ---------- Парсер CSV ----------
  // Учитывает кавычки и экранирование внутри полей, поэтому
  // корректно обрабатывает названия с запятыми и кавычками.
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { field += c; }
      } else {
        if (c === '"') { inQuotes = true; }
        else if (c === ';') { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
          if (field !== '' || row.length) {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
          }
          if (c === '\r' && text[i + 1] === '\n') i++;
        }
        else { field += c; }
      }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  const rows = parseCSV(text.replace(/^\uFEFF/, ''));
  const headers = rows[0];
  const data = rows.slice(1).map(r =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] ?? '']))
  );

  // Собираем ID, помеченные плюсом — из этих сообществ выходим.
  const LEAVE_IDS = data
    .filter(row => (row.keep || '').trim() === '+')
    .map(row => String(row.id).trim())
    .filter(Boolean);

  console.log(`В CSV сообществ: ${data.length}`);
  console.log(`Помечено на выход: ${LEAVE_IDS.length}`);

  if (LEAVE_IDS.length === 0) {
    console.log('Ни одна группа не помечена плюсом — выходить не из чего.');
    return;
  }

  await sleep(1000);

  // ---------- Прокрутка до конца ----------
  console.log('Загружаю сообщества...');
  let lastHeight = 0;
  let stable = 0;

  while (stable < 3) {
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(1500);
    const h = document.body.scrollHeight;
    if (h === lastHeight) stable++;
    else { stable = 0; lastHeight = h; }
  }
  window.scrollTo(0, 0);
  await sleep(500);

  const cells = [...document.querySelectorAll('[class*="vkuiRichCell__host"]')];
  console.log(`Карточек на странице: ${cells.length}`);

  // ---------- Выход из помеченных ----------
  let success = 0;
  let skipped = 0;
  let failed = 0;
  const failedGroups = [];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const id = cell.getAttribute('data-id');
    const name = (cell.getAttribute('aria-label') || '(без названия)').trim();

    if (!LEAVE_IDS.includes(String(id))) {
      skipped++;
      continue;
    }

    console.log(`[${i + 1}/${cells.length}] Выхожу: ${name}`);

    const menuBtn = cell.querySelector('[data-testid="desktop_group_item_button"]');
    if (!menuBtn) {
      failed++;
      failedGroups.push({ id, name, reason: 'нет кнопки меню' });
      console.log('  кнопка меню не найдена');
      continue;
    }

    menuBtn.dispatchEvent(new MouseEvent('mouseover', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
    await sleep(DELAY_AFTER_HOVER);

    // Пункт меню может называться по-разному: у публичных групп
    // «Отписаться», у закрытых — «Покинуть сообщество» и т.п.
    const labels = ['Отписаться', 'Покинуть сообщество', 'Выйти из группы', 'Покинуть группу'];
    const target = [...document.querySelectorAll('*')]
      .find(el => el.textContent && labels.includes(el.textContent.trim()));

    if (!target) {
      failed++;
      failedGroups.push({ id, name, reason: 'пункт меню не найден' });
      console.log('  пункт меню не найден');
      continue;
    }

    target.click();
    console.log('  вышли');
    success++;

    await sleep(DELAY_BETWEEN);
  }

  console.log('\nГотово.');
  console.log(`  вышли: ${success}`);
  console.log(`  пропущено (не помечены): ${skipped}`);
  console.log(`  не удалось: ${failed}`);

  if (failedGroups.length > 0) {
    console.log('\nСообщества, из которых не удалось выйти:');
    console.table(failedGroups);
  }
})();