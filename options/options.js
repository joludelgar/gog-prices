/**
 * Country list options
 */

const defaultCountries = [];
const defaultOptions = {
	"exchangeShow": false,
	"exchangeLocal": true,
	"exchangeCustom": false,
	"exchangeCustomCurrency": "EUR",
	"language": "default"
};
const unavailableCountries = ["RU", "BY"];

let initialState = {
	countriesCustom: [],
	gogPricesOptions: {}
};

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

const getStorage = (keys) => {
    return new Promise((resolve) => {
        ext.storage.sync.get(keys, resolve);
    });
};

const setStorage = (data) => {
    return new Promise((resolve) => {
        ext.storage.sync.set(data, resolve);
    });
};

const syncModalCheckboxes = () => {
	const currentData = parseTableData();
	const activeCodes = new Set(currentData.map(c => c.code.toUpperCase().trim()));

	const checkboxes = document.querySelectorAll("#modalTable .country-selector");
	checkboxes.forEach(cb => {
		const code = cb.dataset.code.toUpperCase().trim();
		cb.checked = activeCodes.has(code);
	});
};

const addCustomCountryRow = (name, code) => {
	const templateRow = document.querySelector("tr.tbody.hide");
	if (!templateRow) return;

	// Check if already exists in editable table
	const existingRows = templateRow.parentNode.querySelectorAll("tr.tbody:not(.hide)");
	let exists = false;
	existingRows.forEach(row => {
		const codeInput = row.querySelector(".country-code");
		if (codeInput && codeInput.value.toUpperCase().trim() === code.toUpperCase().trim()) {
			exists = true;
		}
	});
	if (exists) return;

	// If there's only one row and it is completely empty, remove it (it's the initial placeholder)
	const visibleRows = templateRow.parentNode.querySelectorAll("tr.tbody:not(.hide)");
	if (visibleRows.length === 1) {
		const nameInput = visibleRows[0].querySelector(".country-name");
		const codeInput = visibleRows[0].querySelector(".country-code");
		if (nameInput && codeInput && nameInput.value.trim() === "" && codeInput.value.trim() === "") {
			visibleRows[0].remove();
		}
	}

	const clone = templateRow.cloneNode(true);
	clone.classList.remove("hide");
	clone.querySelector(".country-name").value = name;
	clone.querySelector(".country-code").value = code;

	const warningIcon = clone.querySelector(".icon-warning");
	if (warningIcon) {
		if (unavailableCountries.includes(code.toUpperCase().trim())) {
			warningIcon.classList.remove("icon-hide-warning");
		} else {
			warningIcon.classList.add("icon-hide-warning");
		}
	}

	templateRow.parentNode.appendChild(clone);
	checkValidity();
};

const removeCustomCountryRow = (code) => {
	const templateRow = document.querySelector("tr.tbody.hide");
	if (!templateRow) return;

	const rows = templateRow.parentNode.querySelectorAll("tr.tbody:not(.hide)");
	rows.forEach(row => {
		const codeInput = row.querySelector(".country-code");
		if (codeInput && codeInput.value.toUpperCase().trim() === code.toUpperCase().trim()) {
			row.remove();
		}
	});

	// If all rows are deleted, add one empty row back so the user has an input field
	const remainingRows = templateRow.parentNode.querySelectorAll("tr.tbody:not(.hide)");
	if (remainingRows.length === 0) {
		const clone = templateRow.cloneNode(true);
		clone.classList.remove("hide");
		templateRow.parentNode.appendChild(clone);
	}

	checkValidity();
};

const clearTableData = () => {
	const templateRow = document.querySelector("tr.tbody.hide");
	if (!templateRow) return;
	const parent = templateRow.parentNode;
	const rows = parent.querySelectorAll("tr.tbody:not(.hide)");
	rows.forEach((row) => row.remove());

	// Clone template to create one initial empty row
	const clone = templateRow.cloneNode(true);
	clone.classList.remove("hide");
	parent.appendChild(clone);
	checkValidity();
	syncModalCheckboxes();
};

const setDefaultCountries = async () => {
	await saveOptions(undefined, true);
	clearTableData();
};

const loadFormCountry = () => {
	const addRowBtn = document.querySelector(".table-add");
	if (addRowBtn) {
		addRowBtn.addEventListener("click", () => {
			const templateRow = document.querySelector("tr.tbody.hide");
			if (templateRow) {
				const clone = templateRow.cloneNode(true);
				clone.classList.remove("hide");
				templateRow.parentNode.appendChild(clone);
				checkValidity();
			}
		});
	}

	// Event delegation for removing rows and keyup validation
	const contentTable = document.getElementById("contentTable");
	if (contentTable) {
		contentTable.addEventListener("click", (event) => {
			const removeBtn = event.target.closest(".table-remove");
			if (removeBtn) {
				const row = removeBtn.closest("tr");
				if (row) {
					row.remove();
					checkValidity();
					syncModalCheckboxes();
				}
			}
		});

		// Listen for blur event on country code input to toggle warning icon
		contentTable.addEventListener("blur", (event) => {
			if (event.target.classList.contains("country-code")) {
				const codeInput = event.target;
				const code = codeInput.value.toUpperCase().trim();
				const row = codeInput.closest("tr");
				const warningIcon = row.querySelector(".icon-warning");
				
				if (warningIcon) {
					if (unavailableCountries.includes(code)) {
						warningIcon.classList.remove("icon-hide-warning");
					} else {
						warningIcon.classList.add("icon-hide-warning");
					}
				}
			}
		}, true); // Use capture phase because blur does not bubble

		// Listen for input events to synchronize checkboxes in modal
		contentTable.addEventListener("input", (event) => {
			if (event.target.classList.contains("country-code") || event.target.classList.contains("country-name")) {
				syncModalCheckboxes();
			}
		});
	}

	checkValidity();
};

const checkValidity = () => {
	const inputs = document.querySelectorAll(".tbody:not(.hide) .input");
	validation();

	inputs.forEach((input) => {
		// Remove existing listener to prevent duplicates
		input.removeEventListener("keyup", validation);
		input.addEventListener("keyup", validation);
		
		input.removeEventListener("change", handleInputChange);
		input.addEventListener("change", handleInputChange);
	});

	if (typeof updateWarningBannerVisibility === "function") {
		updateWarningBannerVisibility();
	}
};

const handleInputChange = (e) => {
	const isValid = e.target.reportValidity();
	e.target.setAttribute("aria-invalid", !isValid);
};

const validation = () => {
	const validationResults = [];
	document.querySelectorAll(".tbody:not(.hide) .input").forEach((input) => {
		validationResults.push(input.checkValidity());
	});
	
	const addRowBtn = document.querySelector(".table-add");
	if (addRowBtn) {
		addRowBtn.disabled = !validationResults.every((v) => v === true);
	}
};

const filterModalCountries = () => {
	const input = document.getElementById("modalSearchInput");
	if (!input) return;
	const filter = input.value.toUpperCase();
	const modalTable = document.getElementById("modalTable");
	if (!modalTable) return;
	const rows = modalTable.querySelectorAll("tr.tbody");

	rows.forEach(row => {
		const nameCell = row.cells[0];
		const codeCell = row.cells[1];
		if (nameCell && codeCell) {
			const nameText = nameCell.textContent || nameCell.innerText;
			const codeText = codeCell.textContent || codeCell.innerText;
			if (nameText.toUpperCase().indexOf(filter) > -1 || codeText.toUpperCase().indexOf(filter) > -1) {
				row.style.display = "";
			} else {
				row.style.display = "none";
			}
		}
	});
};

const loadModal = () => {
	const modal = document.getElementById("myModal");
	const btn = document.getElementById("myBtn");
	const span = document.getElementsByClassName("close")[0];
	const modalSearchInput = document.getElementById("modalSearchInput");

	if (modalSearchInput) {
		modalSearchInput.addEventListener("input", filterModalCountries);
	}

	if (btn && modal) {
		btn.onclick = function () {
			modal.style.display = "block";
			if (modalSearchInput) {
				modalSearchInput.value = "";
				filterModalCountries();
			}
		};
	}

	if (span && modal) {
		span.onclick = function () {
			modal.style.display = "none";
		};
	}

	window.addEventListener("click", function (event) {
		if (event.target == modal) {
			modal.style.display = "none";
		}
	});
};

const loadConfirmResetModal = () => {
	const modal = document.getElementById("confirmResetModal");
	const btn = document.getElementById("default-countries");
	const closeSpan = document.getElementById("closeConfirmReset");
	const btnCancel = document.getElementById("btnCancelReset");
	const btnConfirm = document.getElementById("btnConfirmReset");

	if (btn && modal) {
		btn.addEventListener("click", (e) => {
			e.preventDefault();
			modal.style.display = "block";
		});
	}

	const closeModal = () => {
		if (modal) modal.style.display = "none";
	};

	if (closeSpan) {
		closeSpan.addEventListener("click", closeModal);
	}

	if (btnCancel) {
		btnCancel.addEventListener("click", closeModal);
	}

	if (btnConfirm) {
		btnConfirm.addEventListener("click", async () => {
			closeModal();
			await setDefaultCountries();
		});
	}

	window.addEventListener("click", (event) => {
		if (event.target == modal) {
			closeModal();
		}
	});
};

const parseTableData = () => {
	const templateRow = document.querySelector("tr.tbody.hide");
	if (!templateRow) return [];
	const rows = templateRow.parentNode.querySelectorAll("tr.tbody:not(.hide)");
	const data = [];

	rows.forEach((row) => {
		const nameInput = row.querySelector(".country-name");
		const codeInput = row.querySelector(".country-code");
		
		if (nameInput && codeInput) {
			const name = nameInput.value.trim();
			const code = codeInput.value.toUpperCase().trim();
			if (name.length > 1 && code.length > 1) {
				data.push({
					name: name,
					code: code,
					status: unavailableCountries.includes(code) ? "ko" : "ok",
				});
			}
		}
	});

	return data;
};

const setTableData = (data) => {
	const templateRow = document.querySelector("tr.tbody.hide");

	if (!templateRow) return;

	data.forEach((country) => {
		const clone = templateRow.cloneNode(true);
		clone.classList.remove("hide");
		
		const nameInput = clone.querySelector(".country-name");
		const codeInput = clone.querySelector(".country-code");
		const warningIcon = clone.querySelector(".icon-warning");

		if (nameInput) nameInput.value = country.name;
		if (codeInput) codeInput.value = country.code;
		
		if (country.status === "ko" && warningIcon) {
			warningIcon.classList.remove("icon-hide-warning");
		}
		
		templateRow.parentNode.appendChild(clone);
	});

	const firstRowRemoveBtn = document.getElementById("firstRowRemove");
	if (firstRowRemoveBtn) {
		firstRowRemoveBtn.click();
	}
};

/**
 * Miscellaneous options
 */

function checkExchangeTypeAllow() {
	const enableRadio = document.getElementById("exchange-show").checked;
	const localRadio = document.getElementById("exchange-local");
	const customRadio = document.getElementById("exchange-custom");
	const dropBtn = document.getElementById("dropbtn");

	if (localRadio) localRadio.disabled = !enableRadio;
	if (customRadio) customRadio.disabled = !enableRadio;

	if (dropBtn) {
		if (enableRadio && customRadio && customRadio.checked) {
			dropBtn.classList.remove("disabled");
		} else {
			dropBtn.classList.add("disabled");
		}
	}
}

function showDropdown() {
	const dropdown = document.getElementById("myDropdown");
	const svgDown = document.getElementById("svg_down");
	const svgUp = document.getElementById("svg_up");

	if (dropdown) dropdown.classList.toggle("show");
	if (svgDown) svgDown.classList.toggle("hide");
	if (svgUp) svgUp.classList.toggle("show");
}

function filterFunction() {
	const input = document.getElementById("searchInput");
	const filter = input.value.toUpperCase();
	const div = document.getElementById("myDropdown");
	const pElements = div.getElementsByTagName("p");
	
	for (let i = 0; i < pElements.length; i++) {
		const txtValue = pElements[i].textContent || pElements[i].innerText;
		if (txtValue.toUpperCase().indexOf(filter) > -1) {
			pElements[i].style.display = "";
		} else {
			pElements[i].style.display = "none";
		}
	}
}

function selectCustomCurrency(e) {
	const item = e.target.closest("p");
	if (!item) return;

	const btnValue = document.getElementById("exchange-custom-currency");
	if (btnValue) btnValue.value = item.dataset.value;

	document.querySelectorAll("#exchange-list p").forEach(el => {
		el.classList.remove("selected");
	});
	item.classList.add("selected");
	closeExchangeDropdown();

	if (typeof updateWarningBannerVisibility === "function") {
		updateWarningBannerVisibility();
	}
}

function closeExchangeDropdown() {
	const dropdown = document.getElementById("myDropdown");
	const svgDown = document.getElementById("svg_down");
	const svgUp = document.getElementById("svg_up");

	if (dropdown) dropdown.classList.remove("show");
	if (svgDown) svgDown.classList.remove("hide");
	if (svgUp) svgUp.classList.remove("show");
}

function parseOptions() {
	const exchangeShowEl = document.getElementById("exchange-show");
	const exchangeLocalEl = document.getElementById("exchange-local");
	const exchangeCustomEl = document.getElementById("exchange-custom");
	const exchangeCustomCurrencyEl = document.getElementById("exchange-custom-currency");
	const languageSelectEl = document.getElementById("language-select");

	return {
		"exchangeShow": exchangeShowEl.checked,
		"exchangeLocal": exchangeLocalEl.checked,
		"exchangeCustom": exchangeCustomEl.checked,
		"exchangeCustomCurrency": exchangeCustomCurrencyEl.value,
		"language": languageSelectEl ? languageSelectEl.value : "default"
	};
}

function setOptions(options) {
	const exchangeShowEl = document.getElementById("exchange-show");
	const exchangeLocalEl = document.getElementById("exchange-local");
	const exchangeCustomEl = document.getElementById("exchange-custom");
	const exchangeCustomCurrencyEl = document.getElementById("exchange-custom-currency");
	const languageSelectEl = document.getElementById("language-select");

	if (exchangeShowEl) exchangeShowEl.checked = options.exchangeShow;
	if (exchangeLocalEl) exchangeLocalEl.checked = options.exchangeLocal;
	if (exchangeCustomEl) exchangeCustomEl.checked = options.exchangeCustom;
	if (exchangeCustomCurrencyEl) exchangeCustomCurrencyEl.value = options.exchangeCustomCurrency;
	if (languageSelectEl) languageSelectEl.value = options.language || "default";
}

/**
 * General option page functions
 */

const areCustomCountriesEqual = (arr1, arr2) => {
	if (arr1.length !== arr2.length) return false;
	for (let i = 0; i < arr1.length; i++) {
		if (arr1[i].name !== arr2[i].name || 
			arr1[i].code.toUpperCase().trim() !== arr2[i].code.toUpperCase().trim() ||
			arr1[i].status !== arr2[i].status) {
			return false;
		}
	}
	return true;
};

const areOptionsEqual = (opt1, opt2) => {
	return opt1.exchangeShow === opt2.exchangeShow &&
		opt1.exchangeLocal === opt2.exchangeLocal &&
		opt1.exchangeCustom === opt2.exchangeCustom &&
		opt1.exchangeCustomCurrency === opt2.exchangeCustomCurrency &&
		opt1.language === opt2.language;
};

const isStateDirty = () => {
	const currentCountries = parseTableData();
	const currentOptions = parseOptions();
	return !areCustomCountriesEqual(initialState.countriesCustom, currentCountries) ||
		!areOptionsEqual(initialState.gogPricesOptions, currentOptions);
};

const updateWarningBannerVisibility = () => {
	const warningBanner = document.getElementById("unsaved-warning");
	if (!warningBanner) return;
	
	if (isStateDirty()) {
		warningBanner.classList.remove("hidden");
	} else {
		warningBanner.classList.add("hidden");
	}
};

let exchangeData, exchangeCommon;

const loadOptionsLiterals = () => {
	document.title = "GOG Prices - " + getMessage("options");
	
	const tableHeadCountryCode = document.getElementById("lt-table-head-country-code");
	if (tableHeadCountryCode) {
		tableHeadCountryCode.innerHTML = 
		`<span class="cell-icon">${getMessage("tableCountryCode")}
			<span class="info-icon" title="${getMessage("tableCountryCodeInfo")}">
				<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
					<path d="M478-240q21 0 35.5-14.5T528-290q0-21-14.5-35.5T478-340q-21 0-35.5 14.5T428-290q0 21 14.5 35.5T478-240Zm-36-154h74q0-33 7.5-52t42.5-52q26-26 41-49.5t15-56.5q0-56-41-86t-97-30q-57 0-92.5 30T342-618l66 26q5-18 22.5-39t53.5-21q32 0 48 17.5t16 38.5q0 20-12 37.5T506-526q-44 39-54 59t-10 73Zm38 314q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
				</svg>
			</span>
		 </span>`;
	}

	document.querySelectorAll(".country-name").forEach((input) => {
		input.placeholder = getMessage("inputCountry") + "*";
	});
	document.querySelectorAll(".country-code").forEach((input) => {
		input.placeholder = getMessage("inputCode") + "*";
	});
	const modalSearchInput = document.getElementById("modalSearchInput");
	if (modalSearchInput) {
		const placeholderMsg = getMessage("searchPlaceholder");
		if (placeholderMsg) {
			modalSearchInput.placeholder = placeholderMsg;
		}
	}

	document.querySelectorAll("[data-locale]").forEach((el) => {
		const message = getMessage(el.dataset.locale);
		if (message) {
			el.innerHTML = message;
		}
	});
};

// Saves options to storage
const saveOptions = async (e, countriesDefault) => {
	const countryJSON = countriesDefault ? [] : parseTableData();
	const optionsJSON = parseOptions();

	try {
		await setStorage({
			countriesCustom: countryJSON,
			gogPricesOptions: optionsJSON
		});

		initialState = {
			countriesCustom: countryJSON,
			gogPricesOptions: optionsJSON
		};
		if (typeof updateWarningBannerVisibility === "function") {
			updateWarningBannerVisibility();
		}

		// Dynamically reload locale messages and update UI
		await loadLocaleMessages(optionsJSON.language);
		loadOptionsLiterals();
		
		const status = document.getElementById("status");
		if (status) {
			status.textContent = getMessage("saveChangesMessage");
			setTimeout(() => {
				status.textContent = "";
			}, 5000);
		}
	} catch (error) {
		console.error("Error saving options:", error);
	}
};

const initializeModalSelectors = () => {
	const modalTable = document.getElementById("modalTable");
	if (!modalTable) return;

	const rows = modalTable.querySelectorAll("tr.tbody");
	rows.forEach(row => {
		const nameCell = row.cells[0];
		const codeCell = row.cells[1];
		if (nameCell && codeCell) {
			const name = nameCell.textContent.trim();
			const code = codeCell.textContent.trim().toUpperCase();

			const newCell = document.createElement("td");
			newCell.style.textAlign = "center";
			newCell.innerHTML = `<input type="checkbox" class="country-selector" data-code="${code}" data-name="${name}">`;
			row.appendChild(newCell);
		}
	});

	// Handle changes on checkboxes
	modalTable.addEventListener("change", (event) => {
		if (event.target.classList.contains("country-selector")) {
			const cb = event.target;
			const code = cb.dataset.code;
			const name = cb.dataset.name;
			if (cb.checked) {
				addCustomCountryRow(name, code);
			} else {
				removeCustomCountryRow(code);
			}
		}
	});
};

// Restores select box and checkbox state using the preferences
async function restoreOptions() {
	let customLang = "default";
	let st = null;

	try {
		st = await getStorage({
			"countriesCustom": defaultCountries,
			"gogPricesOptions": defaultOptions
		});

		if (st.gogPricesOptions && st.gogPricesOptions.language) {
			customLang = st.gogPricesOptions.language;
		}
	} catch (error) {
		console.error("Error retrieving options from storage during restore:", error);
	}

	await loadLocaleMessages(customLang);

	loadOptionsLiterals();
	loadModal();
	loadFormCountry();
	loadConfirmResetModal();
	initializeModalSelectors();

	if (st) {
		if (st.countriesCustom && st.countriesCustom.length > 0) {
			setTableData(st.countriesCustom);
		}

		if (st.gogPricesOptions) {
			setOptions(st.gogPricesOptions);
		}
	}
	
	checkExchangeTypeAllow();
	syncModalCheckboxes();

	await getExchangeCurrency();

	initialState = {
		countriesCustom: parseTableData(),
		gogPricesOptions: parseOptions()
	};
	if (typeof updateWarningBannerVisibility === "function") {
		updateWarningBannerVisibility();
	}
}

async function getExchangeCurrency() {
	const exchangeApi = [
		"https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
		"https://latest.currency-api.pages.dev/v1/currencies/usd.min.json",
		"https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
		"https://latest.currency-api.pages.dev/v1/currencies/usd.json",
	];

	for (const url of exchangeApi) {
		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`${response.status}`);
			}
			exchangeData = await response.json();
			
			const exchangeDateEl = document.getElementById('exchangeDate');
			if (exchangeDateEl && exchangeData.date) {
				exchangeDateEl.innerHTML = exchangeData.date;
			}
			break; // Stop on first success
		} catch (error) {
			console.warn(`Failed to fetch exchange rates from ${url}:`, error);
		}
	}

	// Resolve currency list locally via commonCurrencies.js
	if (typeof getCommonCurrencies === "function") {
		exchangeCommon = getCommonCurrencies();
		const exchangeList = document.getElementById('exchange-list');
		const currentSelection = document.getElementById("exchange-custom-currency")?.value || "";
		
		if (exchangeList) {
			let exchangeListHtml = "";
			Object.values(exchangeCommon).forEach((price) => {
				const code = price.code.toUpperCase().trim();
				const isSelected = currentSelection === code;
				exchangeListHtml += `<p class="${isSelected ? "selected" : ""}" data-value="${code}">${code} (${price.name})</p>`;
			});
			exchangeList.innerHTML = exchangeListHtml;
			
			// Event delegation for selecting custom currency
			exchangeList.addEventListener("click", (e) => selectCustomCurrency(e));
		}
	}
}

document.addEventListener("DOMContentLoaded", restoreOptions);

const saveBtn = document.getElementById("save");
if (saveBtn) {
	saveBtn.addEventListener("click", saveOptions);
}


document.addEventListener("click", closeExchangeDropdown);

const dropBtn = document.getElementById("dropbtn");
if (dropBtn) {
	dropBtn.addEventListener("click", (e) => e.stopPropagation());
}

const exchangeShowCheck = document.getElementById("exchange-show");
if (exchangeShowCheck) {
	exchangeShowCheck.addEventListener("change", checkExchangeTypeAllow);
}

const exchangeLocalRadio = document.getElementById("exchange-local");
if (exchangeLocalRadio) {
	exchangeLocalRadio.addEventListener("change", checkExchangeTypeAllow);
}

const exchangeCustomRadio = document.getElementById("exchange-custom");
if (exchangeCustomRadio) {
	exchangeCustomRadio.addEventListener("change", checkExchangeTypeAllow);
}

const exchangeCustomBtn = document.getElementById("exchange-custom-btn");
if (exchangeCustomBtn) {
	exchangeCustomBtn.addEventListener("click", showDropdown);
}

const searchInput = document.getElementById("searchInput");
if (searchInput) {
	searchInput.addEventListener("keyup", filterFunction);
}

document.addEventListener("input", () => {
	if (typeof updateWarningBannerVisibility === "function") {
		updateWarningBannerVisibility();
	}
});
document.addEventListener("change", () => {
	if (typeof updateWarningBannerVisibility === "function") {
		updateWarningBannerVisibility();
	}
});