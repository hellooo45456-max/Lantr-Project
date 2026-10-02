const opportunityList = document.querySelector('#opportunity-list');
const weeklyList = document.querySelector('#weekly-list');

opportunityList.innerHTML = siteContent.opportunities.map((item, index) => `
  <article class="opportunity">
    <span class="opportunity-number">0${index + 1}</span>
    <div><p class="opportunity-type">${item.type}</p><h3>${item.title}</h3></div>
    <p class="opportunity-detail">${item.detail}</p>
    <span class="opportunity-status">${item.status} <b>↗</b></span>
  </article>`).join('');

weeklyList.innerHTML = siteContent.weekly.map((item) => `
  <article class="weekly-item">
    <span class="issue">ISSUE ${item.number}</span>
    <div><p class="weekly-date">${item.date}</p><h3>${item.title}</h3><p>${item.excerpt}</p></div>
    <span class="read-arrow">↗</span>
  </article>`).join('');
