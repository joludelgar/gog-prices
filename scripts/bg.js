const literals = {
    notAvailable: chrome.i18n.getMessage("notAvailable"),
    tooltipNotAvailable: chrome.i18n.getMessage("tooltipNotAvailable")
};
const currencyDefault = {code: "USD", symbol: "$"};
var currencySymbol = {USD: "$", AUD: "A$", BRL: "R$", CAD: "C$", CHF: "Fr.", CNY: "¥", DKK: "kr", EUR: "€", GBP: "£", NOK: "kr", PLN: "zł", SEK: "kr", RUB: "₽"};
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
        currency: "CNY"
    }
];
var statusPriority = {
    "ok": 1,
    "ko": 2
}
const buttonSettingLiterals = {show : "Show settings", hide: "Hide settings"};
const buttonCartLiterals = {show : "Virtual cart", hide: "Hide virtual cart"};

var prices = [];
var userSettings, currentStore, currentSymbolStore, exchangeData, showLocalPrice;

addContainer();


window.onpageshow = function() {
    init();
};

async function init() {
    const htmlContainer = document.getElementById("gog-prices_container");
    
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
    await chrome.storage.sync.get(["countriesCustom", "gogPricesOptions"]).then((result) => {
        if (result && !!result.countriesCustom && result.countriesCustom.length > 0) {
            countries = result.countriesCustom;
        }
        if (result && !!result.gogPricesOptions) {
            userSettings = result.gogPricesOptions;
        }
    });
}

function getProductId() {
    var htmlElement = document.querySelector("body.productcard > div.layout");
    if (htmlElement) {
        var productId = htmlElement.getAttribute("card-product");
        currentStore = [...document.getElementsByTagName("body")[0].classList].find(o => o.includes("_prices-in-")).split("_prices-in-")[1].toUpperCase().trim();
        currentSymbolStore = currencySymbol[currentStore].symbol ?? currencySymbol[currentStore];
        showLocalPrice = userSettings.exchangeShow && currentStore != currencyDefault.code;
        getEndpoints(productId);
        var checkPricesIntervalId = setInterval(() => {
            if(checkPrices()) {
                setListCurrency();
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
            <div id="gog-prices_currency" class="hide"></div>
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

function setListCurrency() {
    var store;
    const containerHtml = document.getElementById("gog-prices_currency");
    if (userSettings.exchangeLocal) {
        store = currentStore;
    } else if (userSettings.exchangeCustom) {
        store = userSettings.exchangeCustomCurrency;
    } else {
        store = "";
    }

    containerHtml.innerHTML = `
        <div class="gog-prices-currency-header">
            <p class="gog-prices-currency-cell">${currencyDefault.code}</p>
            ${showLocalPrice ? `<p style="width:${document.getElementsByClassName('gog-prices-price --second')[0].offsetWidth}px" title="${chrome.i18n.getMessage("exchangeTooltip")}" class="gog-prices-currency-cell --second">${store}<span class="--tooltip">?</span></p>` : ""}
        </div>
    `;
}

function addCard() {
    const containerHtml = document.getElementById("gog-prices_container");
    var cardsHtml = "";
    var symbol;
    if (userSettings.exchangeLocal) {
        symbol = currentSymbolStore;
    } else if (userSettings.exchangeCustom) {
        symbol = currencySymbol[userSettings.exchangeCustomCurrency].symbol ?? currencySymbol[userSettings.exchangeCustomCurrency];
    } else {
        symbol = "";
    }

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
            <div class="gog-prices-prices-column">
                <div class="gog-prices-price">
                    ${price.priceBase && price.priceBase !== price.priceTotal ? `<p class="gog-prices-text original">${price.available ? currencyDefault.symbol : ""} ${price.priceBase}</p>` : '<p class="gog-prices-text original hide"></p>'}
                    <p class="gog-prices-text sale">${price.available ? currencyDefault.symbol : ""} ${price.priceTotal}</p>
                </div>
                ${showLocalPrice ? (`<div class="gog-prices-price --second">
                    ${price.priceExchange.priceBase && price.priceExchange.priceBase !== price.priceExchange.priceTotal ? `<p class="gog-prices-text original">${price.available ? symbol : ""} ${price.priceExchange.priceBase}</p>` : '<p class="gog-prices-text original hide"></p>'}
                    <p class="gog-prices-text sale">${price.available ? symbol : ""} ${price.priceExchange.priceTotal}</p>
                </div>`) : ""}
            </div>
        </div>`});

    addLoading(false);
    // addFunctions();
    containerHtml.innerHTML = cardsHtml;
}

async function getEndpoints(id) {
    await getExchangeCurrency();
    await countries.filter(country => userSettings?.options?.unavailable ? country.status !== "ko" : country).filter(country => !country.hasOwnProperty('alt')).map((country, i) => {
        var endpoint = ('https://api.gog.com/products/prices?ids=' + id + '&countryCode=' + country.code)
        fetch(endpoint).then(r => {
            if (r.ok) {
                return r.text();
            }
            throw new Error(r.status);
        }).then(result => {
            var priceLocalTotalFormated, priceLocalBaseFormated;
            var jsonResult = JSON.parse(result);
            var priceTotalFormated = (Number(jsonResult._embedded.items[0]._embedded.prices.find((price) => price.currency.code == currencyDefault.code).finalPrice.split(" ")[0]) / 100).toFixed(2);
            var priceBaseFormated = (Number(jsonResult._embedded.items[0]._embedded.prices.find((price) => price.currency.code == currencyDefault.code).basePrice.split(" ")[0]) / 100).toFixed(2);
            // if (jsonResult._embedded.items[0]._embedded.prices.length > 1 && Object.keys(currencySymbol).includes(country.currency)) {
            //     priceLocalTotalFormated = (Number(jsonResult._embedded.items[0]._embedded.prices.find((price) => price.currency.code == country.currency).finalPrice.split(" ")[0]) / 100).toFixed(2);
            //     priceLocalBaseFormated = (Number(jsonResult._embedded.items[0]._embedded.prices.find((price) => price.currency.code == country.currency).basePrice.split(" ")[0]) / 100).toFixed(2);
            // }
            prices.push({
                country: country.name, 
                code: country.code, 
                priceBase: priceBaseFormated, 
                priceTotal: priceTotalFormated, 
                priceExchange: {
                    priceBase: (priceBaseFormated * exchangeData.usd[userSettings.exchangeShow && userSettings.exchangeCustom ? userSettings.exchangeCustomCurrency.toLowerCase() : currentStore.toLowerCase()]).toFixed(2), 
                    priceTotal: (priceTotalFormated * exchangeData.usd[userSettings.exchangeShow && userSettings.exchangeCustom ? userSettings.exchangeCustomCurrency.toLowerCase() : currentStore.toLowerCase()]).toFixed(2),
                },
                // priceLocal: {
                //     symbol: currencySymbol[country.currency], 
                //     priceBase: priceLocalBaseFormated, 
                //     priceTotal: priceLocalTotalFormated
                // }, 
                status: country.status, 
                available: true});
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

async function getExchangeCurrency() {
    var commonCurrencies =
		"https://raw.githubusercontent.com/fawazahmed0/exchange-api/main/other/Common-Currency.json";
    var exchangeApi = ["https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json", "https://latest.currency-api.pages.dev/v1/currencies/usd.min.json",
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json", "https://latest.currency-api.pages.dev/v1/currencies/usd.json"]
    for (let index = 0; index < exchangeApi.length; index++) {
        if (!exchangeData || new Date(exchangeData?.date).setHours(0, 0, 0, 0) != new Date().setHours(0, 0, 0, 0)) {
            await fetch(exchangeApi[index]).then(r => {
                if (r.ok) {
                    return r.text();
                }
                throw new Error(r.status);
            }).then(result => {
                exchangeData = JSON.parse(result);
            }).catch((error) => {
                console.log(error)
            });
        }
    }

    await fetch(commonCurrencies)
		.then((r) => {
			if (r.ok) {
				return r.text();
			}
			throw new Error(r.status);
		})
		.then((result) => {
			currencySymbol = JSON.parse(result);
		})
		.catch((error) => {
			console.log(error);
		});
}

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
    const currencyHtml = document.getElementById("gog-prices_currency");

    if (active) {
        loadingHtml.classList.remove("hide");
        showMoreHtml.classList.add("hide");
        settingsHtml.classList.add("hide");
        currencyHtml.classList.add("hide");
    } else {
        loadingHtml.classList.add("hide");
        settingsHtml.classList.remove("hide");
        currencyHtml.classList.remove("hide");

        if (countries.length < 4) {
            showMoreHtml.classList.add("hide");
        } else {
            showMoreHtml.classList.remove("hide");
        }
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