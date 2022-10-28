var prices = [];

var literals = {
    notAvailable: "No disponible"
};
var currency = {code: "USD", symbol: "$"};
var countries = [
    {
        name: "Brazil",
        code: "BR",
        status: "ok"
    },
    {
        name: "Ukraine",
        code: "UA",
        status: "ok"
    },
    {
        name: "Russia",
        code: "RU",
        status: "ko"
    }
];

window.onload = function() {
    getProductId()
};

function getProductId() {
    var htmlElement = document.querySelector("body.productcard > div.layout");
    if (htmlElement) {
        var productId = htmlElement.getAttribute("card-product");
        getEndpoints(productId);
    }
}

function addCard() {
    var htmlElement = document.querySelector(".product-actions");
    var card = document.createElement("div");
    var cardsHtml = "";

    prices.sort(function(a, b) {
        return parseFloat(a.priceTotal) - parseFloat(b.priceTotal);
    }).map(price => {
        var unavailable = price.status === "ko";
        cardsHtml += `
        <div class="gog-prices-data">
            <div class="gog-prices-country">
              <img class="gog-prices-img" title=${price.country} alt=${price.country} src=${"chrome-extension://pkcpchkghljidggkhjdhmioeklodnmai/flags/"+price.code+".png"}><img>
              <p class="gog-prices-text">${price.country}</p>
              ${unavailable ? `
                <span class="gog-prices-unavailable">${literals.notAvailable}</span>
              ` : ""}
            </div>
            <div class="gog-prices-price">
              <p class="gog-prices-text original">${currency.symbol} ${price.priceBase}</p>
              <p class="gog-prices-text sale">${currency.symbol} ${price.priceTotal}</p>
            </div>
        </div>`});
    card.innerHTML = `
    <div class="gog-prices-body">
      <div class="gog-prices-container">
        ${cardsHtml}
      </div>
    </div>
    `
    htmlElement.parentElement.parentNode.insertBefore(card, htmlElement.parentElement.nextSibling);
}

function getEndpoints(id) {
    countries.map((country, i) => {
        var endpoint = ('https://api.gog.com/products/prices?ids=' + id + '&countryCode=' + country.code + '&currency=' + currency.code)
        fetch(endpoint).then(r => r.text()).then(result => {
            var jsonResult = JSON.parse(result);
            var priceTotalFormated = (Number(jsonResult._embedded.items[0]._embedded.prices[0].finalPrice.split(" ")[0]) / 100).toFixed(2);
            var priceBaseFormated = (Number(jsonResult._embedded.items[0]._embedded.prices[0].basePrice.split(" ")[0]) / 100).toFixed(2);
            prices.push({country: country.name, code: country.code, priceBase: priceBaseFormated, priceTotal: priceTotalFormated, status: country.status});

            if(i + 1 === countries.length) {
                addCard();
            }
        })
    });
};