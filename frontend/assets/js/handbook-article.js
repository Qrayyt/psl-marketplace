(() => {
  const { articles, articlePath, industries } = window.PSLHandbook;
  const id = new URLSearchParams(location.search).get('id');
  const title = document.querySelector('#title');
  const content = document.querySelector('#content');
  if (!Object.hasOwn(articles, id)) {
    title.textContent = 'Статья не найдена';
    return;
  }
  const article = articles[id];
  document.title = article.title + ' — Справочник PSL';
  title.textContent = article.title;
  if (!article.listing) document.querySelector('#section').textContent = ' / ' + article.section;

  function append(parent, tag, text) {
    const node = document.createElement(tag);
    node.textContent = text;
    parent.append(node);
    return node;
  }
  function link(parent, label, href) {
    append(parent, 'a', label).href = href;
  }
  function articleLinks(ids) {
    const group = append(content, 'div', '');
    group.className = 'wiki-system-links';
    for (const target of ids) link(group, articles[target].title, articlePath(target));
  }
  if (article.listing) {
    articleLinks(industries);
    return;
  }
  if (article.historical) {
    const note = append(content, 'p', 'Справочная редакция. Действующие условия сотрудничества уточняйте у PSL.');
    note.className = 'intro';
  }
  for (const [heading, paragraphs] of article.blocks) {
    append(content, 'h2', heading);
    for (const paragraph of paragraphs) append(content, 'p', paragraph);
  }
  if (article.products?.length) {
    append(content, 'h2', 'Материалы из исходного справочника');
    append(content, 'p', 'Применимость для конкретного объекта проверяйте по действующим техкартам.');
    const list = append(content, 'ul', '');
    list.className = 'wiki-topics';
    const exactProduct = /^(?:FIXTILE (?:GLS(?:100|400|500)|ELS(?:600|700)|ELC10)|WIRON (?:CRYSTAL|ЛАК|FINISH|EP))$/;
    for (const product of article.products) {
      const row = append(list, 'li', '');
      if (exactProduct.test(product)) {
        const slug = product === 'WIRON ЛАК' ? 'wiron-lak' : product.toLowerCase().replace(' ', '-');
        link(row, product, '/product.html?id=' + slug);
      } else {
        row.textContent = product;
      }
    }
  }
  if (article.external) link(content, ...article.external);
  if (article.contact) link(content, 'Позвонить в PSL · 8 800 551‑41‑45', 'tel:+78005514145');
  if (article.related?.length) {
    append(content, 'h2', 'По теме');
    articleLinks(article.related);
  }
})();
