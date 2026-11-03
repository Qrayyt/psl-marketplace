(function(){
  function productVisual(brand, code, accent, variant){
    var dark = variant !== 'light';
    var bg = dark ? '#111111' : '#ececea';
    var fg = dark ? '#ffffff' : '#111111';
    var svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="960" viewBox="0 0 800 960">
        <rect width="800" height="960" fill="${bg}"/>
        <g opacity=".12" stroke="${fg}">
          <path d="M0 120H800M0 240H800M0 360H800M0 480H800M0 600H800M0 720H800M0 840H800"/>
          <path d="M120 0V960M240 0V960M360 0V960M480 0V960M600 0V960M720 0V960"/>
        </g>
        <path d="M605 58h88l-286 844h-88z" fill="${accent}" opacity=".92"/>
        <g transform="translate(130 185)">
          <rect x="240" y="48" width="276" height="450" rx="22" fill="#171717" stroke="#606060" stroke-width="4"/>
          <rect x="280" y="0" width="196" height="74" rx="18" fill="${accent}"/>
          <rect x="0" y="118" width="330" height="480" rx="24" fill="#0b0b0b" stroke="#777" stroke-width="4"/>
          <rect x="52" y="72" width="226" height="82" rx="18" fill="${accent}"/>
          <rect x="28" y="172" width="274" height="290" rx="8" fill="#141414" stroke="${accent}" stroke-width="3"/>
          <text x="52" y="236" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="46" fill="${accent}">${brand}</text>
          <text x="52" y="276" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="20" fill="#fff" opacity=".9">${code}</text>
          <path d="M52 322h164M52 344h110M52 366h188" stroke="#fff" opacity=".36" stroke-width="7"/>
          <path d="M52 416h58l76-76h58l-76 76h58" fill="none" stroke="${accent}" stroke-width="7"/>
          <text x="52" y="538" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="42" fill="#fff">PSL</text>
        </g>
        <text x="56" y="84" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="700" letter-spacing="3" fill="${fg}" opacity=".6">POLYMER SYSTEM LABS</text>
        <text x="56" y="900" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="700" fill="${fg}">${brand} / ${code}</text>
      </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  window.PRODUCTS = [
    {id:'wiron-system',name:'WIRON',price:0,oldPrice:0,category:'Защитные покрытия',tags:['бетон','защита','2K'],sizes:['Комплект A+B'],rating:0,reviews:0,color:'Двухкомпонентная система',description:'Система защитных составов для промышленных оснований и поверхностей. Точная конфигурация подбирается под условия объекта.',details:['Подбор под тип основания','Комплект компонентов A+B','Техническая консультация','Документация по запросу'],accent:'#ed1c24',image:productVisual('WIRON','SYSTEM A+B','#ed1c24','dark')},
    {id:'wiron-pro',name:'WIRON PRO',price:0,oldPrice:0,category:'Защитные покрытия',tags:['промышленность','износ','защита'],sizes:['Подбор специалистом'],rating:0,reviews:0,color:'Промышленная система',description:'Решение для объектов с повышенными требованиями к защите поверхности и эксплуатационной стойкости.',details:['Для промышленных объектов','Система слоёв под задачу','Подбор расхода','Сопровождение внедрения'],accent:'#ed1c24',image:productVisual('WIRON','PROTECTION PRO','#ed1c24','light')},
    {id:'matrix-xbond',name:'FIXTILE MATRIX X-bond',price:0,oldPrice:0,category:'Клеевые системы',tags:['клей','фиксация','основание'],sizes:['Фасовка по запросу'],rating:0,reviews:0,color:'Клеевая система',description:'Клеевая система для профессиональных монтажных задач. Выбор модификации зависит от основания и условий эксплуатации.',details:['Профессиональное применение','Подбор под основание','Технологическая карта','Консультация специалиста'],accent:'#ed1c24',image:productVisual('MATRIX','X-BOND','#ed1c24','dark')},
    {id:'matrix-universal',name:'FIXTILE MATRIX Universal',price:0,oldPrice:0,category:'Клеевые системы',tags:['универсальный','монтаж','система'],sizes:['Фасовка по запросу'],rating:0,reviews:0,color:'Универсальная система',description:'Универсальное решение линейки FIXTILE MATRIX для широкого спектра профессиональных монтажных работ.',details:['Широкий спектр применений','Системный подбор','Техническая документация','Поставка на объект'],accent:'#ed1c24',image:productVisual('MATRIX','UNIVERSAL','#ed1c24','light')},
    {id:'silflex-hydro',name:'SILFLEX Hydro',price:0,oldPrice:0,category:'Гидроизоляция',tags:['вода','эластичность','защита'],sizes:['Система по проекту'],rating:0,reviews:0,color:'Гидроизоляционная система',description:'Система материалов для защиты конструкций от воздействия влаги. Комплектация определяется требованиями проекта.',details:['Защита от влаги','Подбор системы слоёв','Расчёт расхода','Техническая поддержка'],accent:'#ed1c24',image:productVisual('SILFLEX','HYDRO SYSTEM','#ed1c24','dark')},
    {id:'silflex-elastic',name:'SILFLEX Elastic',price:0,oldPrice:0,category:'Гидроизоляция',tags:['эластичность','трещины','влага'],sizes:['Система по проекту'],rating:0,reviews:0,color:'Эластичная система',description:'Эластичное решение для гидроизоляционных задач и оснований, требующих компенсации деформаций.',details:['Эластичная система','Подбор под деформации','Контроль совместимости','Документы по запросу'],accent:'#ed1c24',image:productVisual('SILFLEX','ELASTIC','#ed1c24','light')},
    {id:'dolotex-industrial',name:'DOLOTEX Industrial',price:0,oldPrice:0,category:'Промышленные полы',tags:['пол','нагрузка','промышленность'],sizes:['Система по объекту'],rating:0,reviews:0,color:'Напольная система',description:'Комплексное решение для устройства промышленных полов с подбором под предполагаемую нагрузку.',details:['Подбор под нагрузку','Подготовка основания','Система материалов','Сопровождение объекта'],accent:'#ed1c24',image:productVisual('DOLOTEX','INDUSTRIAL FLOOR','#ed1c24','dark')},
    {id:'dolotex-repair',name:'DOLOTEX Repair',price:0,oldPrice:0,category:'Промышленные полы',tags:['ремонт','восстановление','пол'],sizes:['Расчёт по площади'],rating:0,reviews:0,color:'Ремонтная система',description:'Система для восстановления и ремонта промышленных оснований. Состав решения определяется состоянием объекта.',details:['Диагностика основания','Ремонтная система','Расчёт по площади','Техническая консультация'],accent:'#ed1c24',image:productVisual('DOLOTEX','REPAIR SYSTEM','#ed1c24','light')}
  ];
})();
