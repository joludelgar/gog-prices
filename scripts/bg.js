const literals = {
    notAvailable: chrome.i18n.getMessage("notAvailable"),
    tooltipNotAvailable: chrome.i18n.getMessage("tooltipNotAvailable")
};
const currency = {code: "USD", symbol: "$"};
let countries = [
    {
        name: chrome.i18n.getMessage("regionBR"),
        code: "BR",
        status: "ok",
        currency: "BRL"
    },
    {
        name: chrome.i18n.getMessage("regionUA"),
        code: "UA",
        status: "ok",
        currency: "UAH"
    },
    {
        name: chrome.i18n.getMessage("regionRU"),
        code: "RU",
        status: "ko",
        currency: "RUB"
    },
    {
        name: chrome.i18n.getMessage("regionCN"),
        code: "CN",
        status: "ok",
        currency: "USD"
    }
];
var statusPriority = {
    "ok": 1,
    "ko": 2
}
const buttonSettingLiterals = {show : "Show settings", hide: "Hide settings"};
const buttonCartLiterals = {show : "Virtual cart", hide: "Hide virtual cart"};

var prices = [];
var userSettings;

addContainer();


window.onpageshow = function() {
    init();
};

async function init() {
    const htmlContainer = document.getElementById("gog-prices_container");
    // var getLang = navigator.language;
    
    // await chrome.storage.local.get("options").then(data => {
    //     userSettings = data
    //     console.log(userSettings)
    // });

    await getOptionsSaved();

    if (!htmlContainer) {
        addContainer();
    }

    getProductId();
    // getWhislistId();
}

async function getOptionsSaved() {
    await chrome.storage.sync.get(["countriesCustom"]).then((result) => {
        console.log(result)
        if (result && !!result.countriesCustom && result.countriesCustom.length > 0) {
            countries = result.countriesCustom;
        }
    });
}

function getProductId() {
    var htmlElement = document.querySelector("body.productcard > div.layout");
    if (htmlElement) {
        var productId = htmlElement.getAttribute("card-product");
        getEndpoints(productId);
        var checkPricesIntervalId = setInterval(() => {
            if(checkPrices()) {
                window.clearInterval(checkPricesIntervalId);
            }
        }, 100);
    }
}

function getWhislistId() {
    var htmlElement = document.querySelectorAll(".product-row--wishlist");+
    console.log(htmlElement);
    if (htmlElement) {
        htmlElement.forEach(element => {
            var productId = element.getAttribute("gog-product");
            getEndpoints(productId);
            var checkPricesIntervalId = setInterval(() => {
                if(checkPrices()) {
                    window.clearInterval(checkPricesIntervalId);
                }
            }, 100);
        })
    }
}

function addContainer() {
    var htmlProductElement = document.querySelector(".product-actions");
    var htmlWhishListElement = document.querySelector(".account__product-lists");

    if(htmlProductElement) {
        htmlProductElement.parentElement.parentNode.insertBefore(productComponent(), htmlProductElement.parentElement.nextSibling);
        document.getElementById("gog-prices_btn-show-more").addEventListener("click", showMore);
        document.getElementById("gog-prices_btn-options").addEventListener("click", () => {
            if (chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                window.open(chrome.runtime.getURL('/options/options.html'));
            }
        });
    }

    // if (htmlWhishListElement) {
    //     console.log("whish list page");
    //     htmlWhishListElement.querySelectorAll(".product-row__price").forEach((element) => {
    //         console.log(element);
    //         element.append(whislistComponent())
    //     })
    // }
}

function productComponent() {
    var card = document.createElement("div");

    var loadingHtml = `<div class="gog-prices-loading"><div></div><div></div><div></div></div>`;

    card.innerHTML = `
    <div class="gog-prices-body">
      <div class="gog-prices-container">
        <div class="gog-prices-loading-container" id="gog-prices_loading">
            <div>
                <p>${chrome.i18n.getMessage("loading")}</p>
            </div>
            ${loadingHtml}
        </div>
        <div>
            <div id="gog-prices_setting" class="hide">
                <button title="${chrome.i18n.getMessage("options")}" id="gog-prices_btn-options" class="review__was-helpful-button gog-prices-options gog-prices-settings-button">
                    <img src="https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/settings/wght200/24px.svg" />
                </button>
            </div>
            <div id="gog-prices_container"></div>
        </div>
      </div>
      <div id="gog-prices_show-more" class="gog-prices-show-more hide">
        <button id="gog-prices_btn-show-more" class="review__was-helpful-button gog-prices-settings-button">${chrome.i18n.getMessage("btnShowAll")}</button>
      </div>
    </div>
    `;

    return card;
}

function whislistComponent() {
    var card = document.createElement("div");

    var loadingHtml = `<div class="gog-prices-loading"><div></div><div></div><div></div></div>`;

    card.classList.add("gog-prices-whislist");
    card.innerHTML = `
    <div class="gog-prices-container">
      Hola
    </div>
    `;

    return card;
}

function addCard() {
    const containerHtml = document.getElementById("gog-prices_container");
    var cardsHtml = "";

    prices.sort(function(a, b) {
        return parseFloat(a.priceTotal) - parseFloat(b.priceTotal) || statusPriority[a.status] - statusPriority[b.status];
    }).map((price, index) => {
        cardsHtml += `
        <div class="gog-prices-data ${index > 2 ? "hide" : ""}">
            <div class="gog-prices-countries">
                <div class="gog-prices-country">
                    <img class="gog-prices-img" title=${price.country} alt=${price.country} src=${"https://flagpedia.net/data/flags/w580/"+price.code.toLowerCase()+".png"}><img>
                    <p class="gog-prices-text">${price.country}</p>
                    ${price.status === "ko" ? `
                    <span class="gog-prices-unavailable" title="${literals.tooltipNotAvailable}">${literals.notAvailable}</span>
                    ` : ""}
                </div>
                ${ price.samePrices?.map((sPrice) => (
                    `<div class="gog-prices-country --extra">
                        <img class="gog-prices-img" title=${sPrice.country} alt=${sPrice.country} src=${"https://flagpedia.net/data/flags/w580/"+sPrice.code.toLowerCase()+".png"}><img>
                        <p class="gog-prices-text">${sPrice.country}</p>
                        ${sPrice.status === "ko" ? `
                        <span class="gog-prices-unavailable" title="${literals.tooltipNotAvailable}">${literals.notAvailable}</span>
                        ` : ""}
                    </div>`
                    )).join('') || ""
                }
            </div>
            <div class="gog-prices-price">
                ${price.priceBase && price.priceBase !== price.priceTotal ? `<p class="gog-prices-text original">${price.available ? currency.symbol : ""} ${price.priceBase}</p>` : '<p class="gog-prices-text original hide"></p>'}
                <p class="gog-prices-text sale">${price.available ? currency.symbol : ""} ${price.priceTotal}</p>
            </div>
        </div>`});

    addLoading(false);
    // addFunctions();
    containerHtml.innerHTML = cardsHtml;
}

function getEndpoints(id) {
    countries.filter(country => userSettings?.options?.unavailable ? country.status !== "ko" : country).filter(country => !country.hasOwnProperty('alt')).map((country, i) => {
        var endpoint = ('https://api.gog.com/products/prices?ids=' + id + '&countryCode=' + country.code + '&currency=' + currency.code)
        fetch(endpoint).then(r => {
            if (r.ok) {
                return r.text();
            }
            throw new Error(r.status);
        }).then(result => {
            var jsonResult = JSON.parse(result);
            var priceTotalFormated = (Number(jsonResult._embedded.items[0]._embedded.prices[0].finalPrice.split(" ")[0]) / 100).toFixed(2);
            var priceBaseFormated = (Number(jsonResult._embedded.items[0]._embedded.prices[0].basePrice.split(" ")[0]) / 100).toFixed(2);
            prices.push({country: country.name, code: country.code, priceBase: priceBaseFormated, priceTotal: priceTotalFormated, status: country.status, available: true});
        }).catch((error) => {
            switch (error.message) {
                case "400":
                    prices.push({country: country.name, code: country.code, priceTotal: `${chrome.i18n.getMessage("comingSoon")} / ${chrome.i18n.getMessage("notAvailable")}`, status: country.status, available: false});
                    break;
                default:
                    prices.push({country: country.name, code: country.code, priceTotal: chrome.i18n.getMessage("notAvailable"), status: country.status, available: false});
                    break;
            }
        });
    });
};

function checkPrices() {
    if(prices.length === countries.filter(country => userSettings?.options?.unavailable ? country.status !== "ko" : country).filter(country => !country.hasOwnProperty('alt')).length) {
        mapPrices();
        addCard();
        return true;
    }
}

function mapPrices() {
    prices.map((price) => {
        if (price.status == "ok") {
            var samePrices = prices.filter(p => !isNaN(p.priceTotal) && p.priceTotal == price.priceTotal && p.code != price.code && p.status == "ok");
            var offlineSamePrices = countries.filter(country => country.hasOwnProperty('alt')).filter(country => country.alt == price.code);
            if (samePrices.length > 0) {
                samePrices.map(sPrice => {
                    prices.splice(prices.findIndex(p => p.code == sPrice.code), 1)
                })
                price.samePrices = samePrices;
            }
            if (offlineSamePrices.length > 0) {
                price.samePrices = [...samePrices, ...offlineSamePrices.map(country => ({
                    country: country.name,
                    code: country.code,
                    status: country.status
                }))]
            }
        }
    });
}
 
function addLoading(active) {
    const loadingHtml = document.getElementById("gog-prices_loading");
    const showMoreHtml = document.getElementById("gog-prices_show-more");
    const settingsHtml = document.getElementById("gog-prices_setting");

    if (active) {
        loadingHtml.classList.remove("hide");
        showMoreHtml.classList.add("hide");
        settingsHtml.classList.add("hide");
    } else {
        loadingHtml.classList.add("hide");
        showMoreHtml.classList.remove("hide");
        settingsHtml.classList.remove("hide");
    }
}

function showMore() {
    const prices = document.querySelectorAll(".gog-prices-data");
    const showMoreHtml = document.getElementById("gog-prices_show-more");

    Array.from(prices).map(price => {
        price.classList.remove("hide");
    });

    showMoreHtml.classList.add("hide");
}
 
/* Extra functionality - not implemented yet*/

function addFunctions() {
    const settingsHtml = document.getElementById("gog-prices_setting");

    settingsHtml.innerHTML = `
    <div class="gog-prices-functions">
        ${addSettings()}
        ${!userSettings?.options?.cart ? addVirtualCart() : ""}
    </div>
    `;

    
    document.getElementById("gog-prices_btn-settings").addEventListener("click", toggleSettingsModal);
    // document.getElementById("gog-prices_btn-settings-cancel").addEventListener("click", cancelSettingsModal);
    document.getElementById("gog-prices_btn-settings-apply").addEventListener("click", applySettingsModal);
}

function addSettings() {
    const settingsHtml = document.getElementById("gog-prices_setting");

    return `
    <div class="gog-prices-settings">
        <div id="gog-prices-settings-modal" class="gog-prices-settings-modal">
            <div class="gog-prices-settings-list">
                <form id="optionsForm">
                    <div class="gog-prices-settings-check">
                        <input ${userSettings?.options?.regional ? "checked": ""} type="checkbox" id="gogpricesregional" value="gog-prices-opt-regional">
                        <label for="gog-prices-opt-regional">Show prices in regional currency</label>
                    </div>
                    <div class="gog-prices-settings-check">
                        <input ${userSettings?.options?.unavailable ? "checked": ""} type="checkbox" id="gogpricesoptunavailable" value="gog-prices-opt-unavailable">
                        <label for="gog-prices-opt-unavailable">Hide unavailable regions</label>
                    </div>
                    <div class="gog-prices-settings-check">
                        <input ${userSettings?.options?.cart ? "checked": ""} type="checkbox" id="gogpricesoptcart" value="gog-prices-opt-cart">
                        <label for="gog-prices-opt-cart">Hide virtual cart feature</label>
                    </div>
                </form>
            </div>
            <div class="gog-prices-settings-modal-footer">
                <button id="gog-prices_btn-settings-cancel" class="review__was-helpful-button gog-prices-settings-button --cancel">Cancel</button>
                <button id="gog-prices_btn-settings-apply" class="review__was-helpful-button gog-prices-settings-button --confirm">Apply</button>
            </div>
        </div>
        <button id="gog-prices_btn-settings" class="review__was-helpful-button gog-prices-settings-button">${buttonSettingLiterals.show}</button>
    </div>
    `;
}

function toggleSettingsModal() {
    const settingsModalHtml = document.getElementById("gog-prices-settings-modal");
    const settingsBtnHtml = document.getElementById("gog-prices_btn-settings");
    
    if (settingsModalHtml.classList.contains("visible")) {
        settingsModalHtml.classList.remove("visible");
        settingsBtnHtml.innerText = buttonSettingLiterals.show;
    } else {
        settingsModalHtml.classList.add("visible");
        settingsBtnHtml.innerText = buttonSettingLiterals.hide;
    };
}

function cancelSettingsModal() {
    toggleSettingsModal();
}

function applySettingsModal() {
    const optionsForm = document.getElementById("optionsForm");
    var options = {
        regional: optionsForm.gogpricesregional.checked,
        unavailable: optionsForm.gogpricesoptunavailable.checked,
        cart: optionsForm.gogpricesoptcart.checked
    }

    console.log("opt", options);
    
    chrome.storage.local.set({options})
    init();
    toggleSettingsModal();
}

function getSettings() {
    chrome.storage.local.get(["key"]).then((result) => {
        console.log("Value currently is " + result.key);
    });
}

function addVirtualCart() {
    const settingsHtml = document.getElementById("gog-prices_setting");

    return `
    <div class="gog-prices-settings">
        <div id="gog-prices-settings-modal" class="gog-prices-settings-modal">
            
        </div>
        <button id="gog-prices_btn-settings" class="review__was-helpful-button gog-prices-settings-button">${buttonCartLiterals.show}</button>
    </div>
    `;
}