/**
 * Country list options
 */

const defaultCountries = [];
const defaultOptions = {
	"exchangeShow": true,
	"exchangeLocal": true,
	"exchangeCustom": false,
	"exchangeCustomCurrency": "EUR"
};
const unavailableCountries = ["RU", "BY"];

const setDefaultCountries = () => {
	// document.getElementById('countries').value = defaultCountries;
	saveOptions(undefined, true);
};

const loadFormCountry = () => {
	var $TABLE = $("#table");
	$(".table-add").on("click", function () {
		var $clone = $TABLE.find("tr.hide").clone(true).removeClass("hide");
		$TABLE.find("table").append($clone);
		checkValidity();
	});

	$(".table-remove").on("click", function () {
		$(this).parents("tr").detach();
		checkValidity();
	});

	$(".country-code").on("blur", function (event) {
		if (unavailableCountries.includes($(this)[0].value.toUpperCase())) {
			$(this)
				.parents("td")
				.next()
				.find(".icon-warning")
				.removeClass("icon-hide-warning");
		} else {
			$(this)
				.parents("td")
				.next()
				.find(".icon-warning")
				.addClass("icon-hide-warning");
		}
	});

	checkValidity();
};

const checkValidity = () => {
	var inputs = document.querySelectorAll(".tbody:not(.hide) .input");
	validation();

	inputs.forEach((input) => {
		input.addEventListener("keyup", validation);
		input.addEventListener("change", (e) => {
			const isValid = e.target.reportValidity();
			e.target.setAttribute("aria-invalid", !isValid);
		});
	});
};

const validation = (e) => {
	var validation = [];
	document.querySelectorAll(".tbody:not(.hide) .input").forEach((input) => {
		validation.push(input.checkValidity());
	});
	document.querySelector(".table-add").disabled = !validation.every(
		(v) => v === true
	);
};

const loadModal = () => {
	// Get the modal
	var modal = document.getElementById("myModal");

	// Get the button that opens the modal
	var btn = document.getElementById("myBtn");

	// Get the <span> element that closes the modal
	var span = document.getElementsByClassName("close")[0];

	// When the user clicks the button, open the modal
	btn.onclick = function () {
		modal.style.display = "block";
	};

	// When the user clicks on <span> (x), close the modal
	span.onclick = function () {
		modal.style.display = "none";
	};

	// When the user clicks anywhere outside of the modal, close it
	window.onclick = function (event) {
		if (event.target == modal) {
			modal.style.display = "none";
		}
	};
};

const parseTableData = () => {
	let oTable = document.getElementById("contentTable");
	let data = [...oTable.rows]
		.filter(
			(r) => r.classList.contains("tbody") && !r.classList.contains("hide")
		)
		.map((t) =>
			[...t.children]
				.map((u) => [...u.children].map((i) => i.value).toString())
				.filter((u, i) => i < 2)
		);

	return data
		.filter((c) => c[0].length > 1 && c[1].length > 1)
		.map((country) => {
			return {
				name: country[0].trim(),
				code: country[1].toUpperCase(),
				status: unavailableCountries.includes(country[1].toUpperCase())
					? "ko"
					: "ok",
			};
		});
};

const setTableData = (data) => {
	var $TABLE = $("#table");
	data.map((country) => {
		var $clone = $TABLE.find("tr.hide").clone(true).removeClass("hide");
		$clone[0].children[0].children[0].value = country.name;
		$clone[0].children[1].children[0].value = country.code;
		if (country.status === "ko") {
			$clone[0].children[2].children[0].classList.remove("icon-hide-warning");
		}
		$TABLE.find("table").append($clone);
	});
	document.getElementById("firstRowRemove").click();
};

/**
 * Miscellaneous options
 */

// Exchange options

function checkExchangeTypeAllow() {
	var enableRadio = document.getElementById("exchange-show").checked;
	document.getElementById("exchange-local").disabled = !enableRadio;
	document.getElementById("exchange-custom").disabled = !enableRadio;
	enableRadio && document.getElementById("exchange-custom").checked ? document.getElementById("dropbtn").classList.remove("disabled") : document.getElementById("dropbtn").classList.add("disabled");
}

function showDropdown() {
	document.getElementById("myDropdown").classList.toggle("show");
	document.getElementById("svg_down").classList.toggle("hide");
	document.getElementById("svg_up").classList.toggle("show");
}

function filterFunction() {
	const input = document.getElementById("searchInput");
	const filter = input.value.toUpperCase();
	const div = document.getElementById("myDropdown");
	const a = div.getElementsByTagName("p");
	for (let i = 0; i < a.length; i++) {
		txtValue = a[i].textContent || a[i].innerText;
		if (txtValue.toUpperCase().indexOf(filter) > -1) {
			a[i].style.display = "";
		} else {
			a[i].style.display = "none";
		}
	}
}

function selectCustomCurrency(e) {
	const btnValue = document.getElementById("exchange-custom-currency");
	btnValue.value = e.target.dataset.value;
	document.querySelectorAll("#exchange-list p").forEach(el => {
		el.classList.remove("selected");
	});
	e.target.classList.add("selected");
	closeExhangeDropdown();
}

function closeExhangeDropdown() {
	document.getElementById("myDropdown").classList.remove("show");
	document.getElementById("svg_down").classList.remove("hide");
	document.getElementById("svg_up").classList.remove("show");
}

function parseOptions() {
	const exchangeShowEl = document.getElementById("exchange-show");
	const exchangeLocalEl = document.getElementById("exchange-local");
	const exchangeCustomEl = document.getElementById("exchange-custom");
	const exchangeCustomCurrencyEl = document.getElementById("exchange-custom-currency");

	return {
		"exchangeShow": exchangeShowEl.checked,
		"exchangeLocal": exchangeLocalEl.checked,
		"exchangeCustom": exchangeCustomEl.checked,
		"exchangeCustomCurrency": exchangeCustomCurrencyEl.value
	}
}

function setOptions(options) {
	const exchangeShowEl = document.getElementById("exchange-show");
	const exchangeLocalEl = document.getElementById("exchange-local");
	const exchangeCustomEl = document.getElementById("exchange-custom");
	const exchangeCustomCurrencyEl = document.getElementById("exchange-custom-currency");

	exchangeShowEl.checked = options.exchangeShow;
	exchangeLocalEl.checked = options.exchangeLocal;
	exchangeCustomEl.checked = options.exchangeCustom;
	exchangeCustomCurrencyEl.value = options.exchangeCustomCurrency;
}

/**
 * General option page functions
 */

var exchangeData, exchangeCommon;

const loadOptionsLiterals = () => {
	document.title = "GOG Prices - " + chrome.i18n.getMessage("options");
	document.getElementById("lt-table-head-country-code").innerHTML = 
	`<span class="cell-icon">${chrome.i18n.getMessage("tableCountryCode")}
		<span class="info-icon" title="${chrome.i18n.getMessage("tableCountryCodeInfo")}">
			<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
				<path d="M478-240q21 0 35.5-14.5T528-290q0-21-14.5-35.5T478-340q-21 0-35.5 14.5T428-290q0 21 14.5 35.5T478-240Zm-36-154h74q0-33 7.5-52t42.5-52q26-26 41-49.5t15-56.5q0-56-41-86t-97-30q-57 0-92.5 30T342-618l66 26q5-18 22.5-39t53.5-21q32 0 48 17.5t16 38.5q0 20-12 37.5T506-526q-44 39-54 59t-10 73Zm38 314q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
			</svg>
		</span>
	 </span>`;
	document.querySelectorAll(".country-name").forEach((input) => {
		input.placeholder = chrome.i18n.getMessage("inputCountry") + "*";
	});
	document.querySelectorAll(".country-code").forEach((input) => {
		input.placeholder = chrome.i18n.getMessage("inputCode") + "*";
	});
	document.querySelectorAll("[data-locale]").forEach((el) => {
		el.innerHTML = chrome.i18n.getMessage(el.dataset.locale);
	});
};

// Saves options to chrome.storage
const saveOptions = (e, countriesDefault) => {
	// const countries = document.getElementById('countries').value;
	const countryJSON = countriesDefault ? [] : parseTableData();
	const optionsJSON = parseOptions();

	chrome.storage.sync.set({ 
		countriesCustom: countryJSON,
		gogPricesOptions: optionsJSON
	 }, () => {
		// Update status to let user know options were saved.
		const status = document.getElementById("status");
		status.textContent = chrome.i18n.getMessage("saveChangesMessage");
		setTimeout(() => {
			status.textContent = "";
		}, 5000);
	});
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
async function restoreOptions() {
	loadOptionsLiterals();
	loadModal();
	loadFormCountry();

	await chrome.storage.sync.get(
		{ "countriesCustom": defaultCountries,
		"gogPricesOptions": defaultOptions },
		(st) => {
			// document.getElementById('countries').value = JSON.stringify(items.countriesCustom);
			if (st.countriesCustom.length > 0) {
				setTableData(st.countriesCustom);
			}

			setOptions(st.gogPricesOptions);
			checkExchangeTypeAllow();
		}
	);

	await getExchangeCurrency();
}

async function getExchangeCurrency() {
	var commonCurrencies =
		"https://raw.githubusercontent.com/fawazahmed0/exchange-api/main/other/Common-Currency.json";
	var exchangeApi = [
		"https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
		"https://latest.currency-api.pages.dev/v1/currencies/usd.min.json",
		"https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
		"https://latest.currency-api.pages.dev/v1/currencies/usd.json",
	];
	for (let index = 0; index < exchangeApi.length; index++) {
		if (
			!exchangeData ||
			new Date(exchangeData?.date).setHours(0, 0, 0, 0) !=
			new Date().setHours(0, 0, 0, 0)
		) {
			await fetch(exchangeApi[index])
				.then((r) => {
					if (r.ok) {
						return r.text();
					}
					throw new Error(r.status);
				})
				.then((result) => {
					exchangeData = JSON.parse(result);
					const exchangeDate = document.getElementById('exchangeDate');
					exchangeDate.innerHTML = exchangeData.date;
				})
				.catch((error) => {
					console.log(error);
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
			exchangeCommon = JSON.parse(result);
			const exchangeList = document.getElementById('exchange-list');
			Object.values(exchangeCommon).map((price) => {
				exchangeList.innerHTML += `<p class="${document.getElementById("exchange-custom-currency").value == price.code.toUpperCase().trim() ? "selected" : "" }" data-value="${price.code.toUpperCase().trim()}">${price.code.toUpperCase().trim() + " (" + price.name + ")"}</p>`
			})
			document.querySelectorAll("#exchange-list p").forEach(el => {
				el.addEventListener("click", (e) => selectCustomCurrency(e));
			});
		})
		.catch((error) => {
			console.log(error);
		});
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.getElementById("save").addEventListener("click", saveOptions);
document
	.getElementById("default-countries")
	.addEventListener("click", setDefaultCountries);

document.addEventListener("click", closeExhangeDropdown);
document
	.getElementById("dropbtn")
	.addEventListener("click", (e) => e.stopPropagation());

document
	.getElementById("exchange-show")
	.addEventListener("change", checkExchangeTypeAllow);
document
	.getElementById("exchange-local")
	.addEventListener("change", checkExchangeTypeAllow);
document
	.getElementById("exchange-custom")
	.addEventListener("change", checkExchangeTypeAllow);
document
	.getElementById("exchange-custom-btn")
	.addEventListener("click", showDropdown);
document
	.getElementById("searchInput")
	.addEventListener("keyup", filterFunction);