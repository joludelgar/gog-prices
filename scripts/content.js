// Cross-browser storage wrapper (Chrome / Firefox)
const ext = typeof browser !== "undefined" ? browser : chrome;

let localeMessages = null;

async function loadLocaleMessages(lang) {
    if (!lang || lang === "default") {
        localeMessages = null;
        return;
    }
    try {
        const url = ext.runtime.getURL(`_locales/${lang}/messages.json`);
        const response = await fetch(url);
        if (response.ok) {
            localeMessages = await response.json();
        } else {
            console.warn(`Failed to load locale messages for ${lang}: ${response.status}`);
            localeMessages = null;
        }
    } catch (e) {
        console.error(`Error loading locale messages for ${lang}:`, e);
        localeMessages = null;
    }
}

function getMessage(key) {
    if (localeMessages && localeMessages[key] && localeMessages[key].message !== undefined) {
        return localeMessages[key].message;
    }
    return ext.i18n.getMessage(key);
}

let LITERALS = {
    notAvailable: "",
    tooltipNotAvailable: ""
};

function initLiterals() {
    LITERALS.notAvailable = getMessage("notAvailable");
    LITERALS.tooltipNotAvailable = getMessage("tooltipNotAvailable");
}

const CURRENCY_DEFAULT = { code: "USD", symbol: "$" };

let countries = [
    {
        name: "",
        localeKey: "regionBR",
        code: "BR",
        status: "ok",
        currency: "BRL"
    },
    {
        name: "",
        localeKey: "regionUA",
        code: "UA",
        status: "ok",
        currency: "UAH"
    },
    {
        name: "",
        localeKey: "regionRU",
        code: "RU",
        status: "ko",
        currency: "RUB"
    },
    {
        name: "",
        localeKey: "regionCN",
        code: "CN",
        status: "ok",
        currency: "CNY"
    }
];

function translateDefaultCountries() {
    countries.forEach(country => {
        if (country.localeKey) {
            country.name = getMessage(country.localeKey);
        }
    });
}

function translateContainer() {
    const loadingTextEl = document.querySelector("#gog-prices_loading p");
    if (loadingTextEl) {
        loadingTextEl.textContent = getMessage("loading");
    }

    const optionsBtn = document.getElementById("gog-prices_btn-options");
    if (optionsBtn) {
        optionsBtn.title = getMessage("options");
    }

    const showMoreBtn = document.getElementById("gog-prices_btn-show-more");
    if (showMoreBtn) {
        showMoreBtn.textContent = getMessage("btnShowAll");
    }
}

const statusPriority = {
    "ok": 1,
    "ko": 2
};

let prices = [];
let userSettings, currentStore, currentSymbolStore, exchangeData, showLocalPrice;

const getStorage = (keys) => {
    return new Promise((resolve) => {
        ext.storage.sync.get(keys, resolve);
    });
};

let isLoading = false;
let isLoaded = false;

// Initialize container immediately if possible, and on page show
init();

window.onpageshow = function () {
    init();
};

async function init() {
    if (isLoading || isLoaded) {
        return;
    }
    isLoading = true;

    try {
        await getOptionsSaved();

        const htmlContainer = document.getElementById("gog-prices_container");
        if (!htmlContainer) {
            addContainer();
        }

        const success = await getProductId();
        if (success) {
            isLoaded = true;
        }
    } catch (error) {
        console.error("Error during initialization:", error);
    } finally {
        isLoading = false;
    }
}

async function getOptionsSaved() {
    try {
        const result = await getStorage(["countriesCustom", "gogPricesOptions"]);
        if (result) {
            if (result.gogPricesOptions) {
                userSettings = result.gogPricesOptions;
            }

            // Load custom locale messages
            const lang = userSettings?.language || "default";
            await loadLocaleMessages(lang);

            if (result.countriesCustom && result.countriesCustom.length > 0) {
                countries = result.countriesCustom;
            } else {
                translateDefaultCountries();
            }
        } else {
            await loadLocaleMessages("default");
            translateDefaultCountries();
        }
    } catch (error) {
        console.error("Error retrieving settings from storage:", error);
        await loadLocaleMessages("default");
        translateDefaultCountries();
    }

    // Initialize LITERALS
    initLiterals();
    translateContainer();
}

async function getProductId() {
    const htmlElement = document.querySelector("body.productcard > div.layout");
    if (!htmlElement) return;

    const productId = htmlElement.getAttribute("card-product");
    if (!productId) return;

    const bodyElement = document.querySelector("body");
    if (!bodyElement) return;

    const pricesClass = [...bodyElement.classList].find(cls => cls.includes("_prices-in-"));
    if (!pricesClass) return;

    currentStore = pricesClass.split("_prices-in-")[1].toUpperCase().trim();

    // Resolve store currency symbol locally
    const localCurrencies = typeof getCommonCurrencies === "function" ? getCommonCurrencies() : {};
    const currencyInfo = localCurrencies[currentStore] || {};
    currentSymbolStore = currencyInfo.symbol ?? currentStore;

    showLocalPrice = userSettings ? userSettings.exchangeShow && currentStore !== CURRENCY_DEFAULT.code : false;

    addLoading(true);

    // Fetch exchange rates and endpoints in parallel
    await getExchangeCurrency();

    const targetCountries = countries
        .filter(country => userSettings?.options?.unavailable ? country.status !== "ko" : true)
        .filter(country => !country.hasOwnProperty('alt'));

    const pricePromises = targetCountries.map(country => fetchPriceForCountry(productId, country));
    const rawPrices = await Promise.all(pricePromises);

    // Group and sort pricing data
    prices = groupPrices(rawPrices);

    setListCurrency();
    addCard();
    addLoading(false);
    return true;
}

function getTheme() {
    if (document.documentElement.hasAttribute("data-theme")) {
        return document.documentElement.matches('[data-theme^="light"]') ? "light" : "dark";
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? "light" : "dark";
}

function updateTheme() {
    const theme = getTheme();
    const body = document.querySelector(".gog-prices-body");
    if (body) {
        body.classList.remove("--theme-light", "--theme-dark");
        body.classList.add(`--theme-${theme}`);
    }
}

function addContainer() {
    if (document.getElementById("gog-prices_container")) {
        return;
    }

    const bundleHero = document.querySelector(".bundle-hero");
    let inserted = false;

    if (bundleHero) {
        bundleHero.parentNode.insertBefore(productComponent(), bundleHero.nextSibling);
        inserted = true;
    } else {
        const htmlProductElement = document.querySelector(".product-actions");
        if (htmlProductElement) {
            htmlProductElement.parentElement.parentNode.insertBefore(productComponent(), htmlProductElement.parentElement.nextSibling);
            inserted = true;
        }
    }

    if (inserted) {
        const showMoreBtn = document.getElementById("gog-prices_btn-show-more");
        if (showMoreBtn) {
            showMoreBtn.addEventListener("click", showMore);
        }

        const optionsBtn = document.getElementById("gog-prices_btn-options");
        if (optionsBtn) {
            optionsBtn.addEventListener("click", () => {
                if (ext.runtime.openOptionsPage) {
                    ext.runtime.openOptionsPage();
                } else {
                    window.open(ext.runtime.getURL('/options/options.html'));
                }
            });
        }

        // Watch for page theme changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === "data-theme") {
                    updateTheme();
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true });

        // Watch for system/browser theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
        const mediaQueryListener = () => {
            if (!document.documentElement.hasAttribute("data-theme")) {
                updateTheme();
            }
        };
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', mediaQueryListener);
        } else if (mediaQuery.addListener) {
            mediaQuery.addListener(mediaQueryListener);
        }

        translateContainer();
    }
}

function productComponent() {
    const card = document.createElement("div");
    const loadingHtml = `<div class="gog-prices-loading"><div></div><div></div><div></div></div>`;
    const theme = getTheme();

    card.innerHTML = `
    <div class="gog-prices-body --theme-${theme}">
      <div class="gog-prices-container">
        <div class="gog-prices-loading-container" id="gog-prices_loading">
            <div>
                <p>${getMessage("loading")}</p>
            </div>
            ${loadingHtml}
        </div>
        <div>
            <div id="gog-prices_setting" class="hide">
                <button title="${getMessage("options")}" id="gog-prices_btn-options" class="review__was-helpful-button gog-prices-options gog-prices-settings-button">
                    <img src="https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/settings/wght200/24px.svg" alt="Settings" />
                </button>
            </div>
            <div class="gog-prices-grid-container">
                <div id="gog-prices_currency" class="hide"></div>
                <div id="gog-prices_container"></div>
            </div>
        </div>
      </div>
      <div id="gog-prices_show-more" class="gog-prices-show-more hide">
        <button id="gog-prices_btn-show-more" class="review__was-helpful-button gog-prices-settings-button">${getMessage("btnShowAll")}</button>
      </div>
    </div>
    `;

    return card;
}

function setListCurrency() {
    const containerHtml = document.getElementById("gog-prices_currency");
    if (!containerHtml) return;

    let store = currentStore;
    if (userSettings?.exchangeCustom) {
        store = userSettings.exchangeCustomCurrency;
    }

    containerHtml.innerHTML = `
        <div class="gog-prices-currency-header ${showLocalPrice && exchangeData ? "--has-exchange" : ""}">
            <div class="gog-prices-currency-cell-empty"></div>
            <p class="gog-prices-currency-cell">${CURRENCY_DEFAULT.code}</p>
            ${showLocalPrice && exchangeData ? `<p title="${getMessage("exchangeTooltip")}" class="gog-prices-currency-cell --second">${store}<span class="--tooltip">?</span></p>` : ""}
        </div>
    `;
}

function addCard() {
    const containerHtml = document.getElementById("gog-prices_container");
    if (!containerHtml) return;

    let symbol = currentSymbolStore;
    if (userSettings?.exchangeCustom) {
        const localCurrencies = typeof getCommonCurrencies === "function" ? getCommonCurrencies() : {};
        const customCode = userSettings.exchangeCustomCurrency;
        symbol = localCurrencies[customCode]?.symbol ?? customCode;
    }

    let cardsHtml = "";
    prices.forEach((price, index) => {
        const sameCount = price.samePrices ? price.samePrices.length : 0;
        const totalCount = 1 + sameCount;

        let countriesHtml = `
            <div class="gog-prices-country">
                <img class="gog-prices-img" title="${price.country}" alt="${price.country}" src="https://flagpedia.net/data/flags/w580/${price.code.toLowerCase()}.png">
                <p class="gog-prices-text">${price.country}</p>
                ${price.status === "ko" ? `
                <span class="gog-prices-unavailable" title="${LITERALS.tooltipNotAvailable}">${LITERALS.notAvailable}</span>
                ` : ""}
            </div>
        `;

        if (totalCount > 2) {
            const firstSame = price.samePrices[0];
            countriesHtml += `
                <div class="gog-prices-country --extra">
                    <img class="gog-prices-img" title="${firstSame.country}" alt="${firstSame.country}" src="https://flagpedia.net/data/flags/w580/${firstSame.code.toLowerCase()}.png">
                    <p class="gog-prices-text">${firstSame.country}</p>
                    ${firstSame.status === "ko" ? `
                    <span class="gog-prices-unavailable" title="${LITERALS.tooltipNotAvailable}">${LITERALS.notAvailable}</span>
                    ` : ""}
                </div>
            `;

            const remainingCount = totalCount - 2;
            const remainingCountries = price.samePrices.slice(1);

            countriesHtml += `
                <div class="gog-prices-more-badge-container">
                    <div class="gog-prices-more-badge">+${remainingCount}</div>
                    <div class="gog-prices-hover-modal">
                        <div class="gog-prices-hover-modal-header">${getMessage("moreCountries")}</div>
                        <div class="gog-prices-hover-modal-content">
                            ${remainingCountries.map(sPrice => `
                                <div class="gog-prices-hover-modal-item">
                                    <img class="gog-prices-img" title="${sPrice.country}" alt="${sPrice.country}" src="https://flagpedia.net/data/flags/w580/${sPrice.code.toLowerCase()}.png">
                                    <span class="gog-prices-hover-modal-text">${sPrice.country}</span>
                                    ${sPrice.status === "ko" ? `
                                    <span class="gog-prices-hover-modal-unavailable" title="${LITERALS.tooltipNotAvailable}">${LITERALS.notAvailable}</span>
                                    ` : ""}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        } else {
            countriesHtml += price.samePrices?.map((sPrice) => `
                <div class="gog-prices-country --extra">
                    <img class="gog-prices-img" title="${sPrice.country}" alt="${sPrice.country}" src="https://flagpedia.net/data/flags/w580/${sPrice.code.toLowerCase()}.png">
                    <p class="gog-prices-text">${sPrice.country}</p>
                    ${sPrice.status === "ko" ? `
                    <span class="gog-prices-unavailable" title="${LITERALS.tooltipNotAvailable}">${LITERALS.notAvailable}</span>
                    ` : ""}
                </div>
            `).join('') || "";
        }

        cardsHtml += `
        <div class="gog-prices-data ${index > 2 ? "hide" : ""} ${showLocalPrice && exchangeData ? "--has-exchange" : ""}">
            <div class="gog-prices-countries">
                ${countriesHtml}
            </div>
            <div class="gog-prices-price">
                ${price.priceBase && price.priceBase !== price.priceTotal && price.available ? `<p class="gog-prices-text original">${CURRENCY_DEFAULT.symbol} ${price.priceBase}</p>` : '<p class="gog-prices-text original hide"></p>'}
                <p class="gog-prices-text sale">${price.available ? CURRENCY_DEFAULT.symbol : ""} ${price.priceTotal}</p>
            </div>
            ${showLocalPrice && exchangeData ? `
            <div class="gog-prices-price --second">
                ${price.priceExchange?.priceBase && price.priceExchange.priceBase !== price.priceExchange.priceTotal && price.available ? `<p class="gog-prices-text original">${symbol} ${price.priceExchange.priceBase}</p>` : '<p class="gog-prices-text original hide"></p>'}
                <p class="gog-prices-text sale">${price.available ? symbol : ""} ${price.priceExchange?.priceTotal || ""}</p>
            </div>
            ` : ""}
        </div>`;
    });

    containerHtml.innerHTML = cardsHtml;
}

async function fetchPriceForCountry(productId, country) {
    // Old API url
    const endpoint = `https://api.gog.com/products/prices?ids=${productId}&countryCode=${country.code}`;
    // New API url
    // const endpoint = `https://api.gog.com/products/${productId}/prices?countryCode=${country.code}`;
    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`${response.status}`);
        }
        const text = await response.text();
        const jsonResult = JSON.parse(text);

        // Old structure ---------------------------
        const item = jsonResult?._embedded?.items?.[0];
        if (!item) {
            throw new Error("Invalid response structure");
        }

        const pricesList = item._embedded?.prices || [];
        if (!pricesList) {
            throw new Error("Invalid response structure");
        }
        // ----------------------------------------

        // New structure
        // const pricesList = jsonResult._embedded?.prices || [];
        // if (!pricesList) {
        //     throw new Error("Invalid response structure");
        // }

        const usdPrice = pricesList.find(p => p.currency?.code === CURRENCY_DEFAULT.code);
        if (!usdPrice) {
            throw new Error("USD price not found in response");
        }

        const finalPriceVal = usdPrice.finalPrice;
        const basePriceVal = usdPrice.basePrice;

        const priceTotalFormated = (Number(finalPriceVal.split(" ")[0]) / 100).toFixed(2);
        const priceBaseFormated = (Number(basePriceVal.split(" ")[0]) / 100).toFixed(2);

        // Exchange rates calculation
        let priceExchange = { priceBase: "0.00", priceTotal: "0.00" };
        if (exchangeData?.usd) {
            const targetCurrency = userSettings?.exchangeShow && userSettings?.exchangeCustom
                ? userSettings.exchangeCustomCurrency.toLowerCase()
                : currentStore.toLowerCase();
            const rate = exchangeData.usd[targetCurrency];
            if (rate) {
                priceExchange = {
                    priceBase: (priceBaseFormated * rate).toFixed(2),
                    priceTotal: (priceTotalFormated * rate).toFixed(2)
                };
            }
        }

        return {
            country: country.name,
            code: country.code,
            priceBase: priceBaseFormated,
            priceTotal: priceTotalFormated,
            priceExchange: priceExchange,
            status: country.status,
            available: true
        };
    } catch (error) {
        console.error(`Error fetching price for ${country.name} (${country.code}):`, error);

        let priceTotal = getMessage("notAvailable");
        if (error.message === "400") {
            priceTotal = `${getMessage("comingSoon")} / ${getMessage("notAvailable")}`;
        }

        return {
            country: country.name,
            code: country.code,
            priceTotal: priceTotal,
            status: country.status,
            available: false
        };
    }
}

async function getExchangeCurrency() {
    if (exchangeData) return;

    const exchangeApi = [
        "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
        "https://latest.currency-api.pages.dev/v1/currencies/usd.min.json",
        "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
        "https://latest.currency-api.pages.dev/v1/currencies/usd.json"
    ];

    for (const url of exchangeApi) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`${response.status}`);
            }
            exchangeData = await response.json();
            break; // Stop on first success
        } catch (error) {
            console.warn(`Failed to fetch exchange rates from ${url}:`, error);
        }
    }
}

function groupPrices(fetchedPrices) {
    const grouped = [];
    const processedCodes = new Set();

    // Sort fetched prices by priceTotal (ascending)
    const sortedPrices = [...fetchedPrices].sort((a, b) => {
        const priceA = parseFloat(a.priceTotal);
        const priceB = parseFloat(b.priceTotal);
        if (isNaN(priceA) && isNaN(priceB)) return 0;
        if (isNaN(priceA)) return 1;
        if (isNaN(priceB)) return -1;

        if (priceA !== priceB) {
            return priceA - priceB;
        }
        return (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99);
    });

    for (const price of sortedPrices) {
        if (processedCodes.has(price.code)) {
            continue;
        }

        // Group only available regions with matching prices
        if (price.status === "ok" && !isNaN(parseFloat(price.priceTotal))) {
            const samePrices = sortedPrices.filter(p =>
                p.code !== price.code &&
                p.status === "ok" &&
                p.priceTotal === price.priceTotal &&
                !processedCodes.has(p.code)
            );

            const offlineSamePrices = countries.filter(country =>
                country.alt === price.code
            ).map(country => ({
                country: country.name,
                code: country.code,
                status: country.status
            }));

            price.samePrices = [
                ...(samePrices || []),
                ...offlineSamePrices
            ];

            // Mark grouped prices as processed
            samePrices.forEach(p => processedCodes.add(p.code));
        }

        processedCodes.add(price.code);
        grouped.push(price);
    }

    return grouped;
}

function addLoading(active) {
    const loadingHtml = document.getElementById("gog-prices_loading");
    const showMoreHtml = document.getElementById("gog-prices_show-more");
    const settingsHtml = document.getElementById("gog-prices_setting");
    const currencyHtml = document.getElementById("gog-prices_currency");

    if (!loadingHtml || !showMoreHtml || !settingsHtml || !currencyHtml) return;

    if (active) {
        loadingHtml.classList.remove("hide");
        showMoreHtml.classList.add("hide");
        settingsHtml.classList.add("hide");
        currencyHtml.classList.add("hide");
    } else {
        loadingHtml.classList.add("hide");
        settingsHtml.classList.remove("hide");
        currencyHtml.classList.remove("hide");

        const container = document.querySelector(".gog-prices-container");
        if (prices.length < 4) {
            showMoreHtml.classList.add("hide");
            container?.classList.add("--no-button");
        } else {
            showMoreHtml.classList.remove("hide");
            container?.classList.remove("--no-button");
        }

        const gridContainer = document.querySelector(".gog-prices-grid-container");
        if (gridContainer) {
            if (showLocalPrice && exchangeData) {
                gridContainer.classList.add("--has-exchange");
            } else {
                gridContainer.classList.remove("--has-exchange");
            }
        }
    }
}

function showMore() {
    const pricesList = document.querySelectorAll(".gog-prices-data");
    const showMoreHtml = document.getElementById("gog-prices_show-more");

    Array.from(pricesList).forEach(price => {
        price.classList.remove("hide");
    });

    if (showMoreHtml) {
        showMoreHtml.classList.add("hide");
    }

    const container = document.querySelector(".gog-prices-container");
    container?.classList.add("--no-button");
}
