// ==UserScript==
// @name         Zendesk Highlighter Forma
// @namespace    urn:zendesk-highlighter:forma
// @version      9.01
// @updateURL    none
// @downloadURL  none
// @description  Highlight key phrases in comments and ticket subject securely without breaking HTML
// @match        https://*.zendesk.com/*
// @match        https://hub.solidgate.com/payments/order*
// @grant        GM.getValue
// @grant        GM.setValue
// ==/UserScript==

(function () {
    'use strict';

    // Support ONE editing Zendesk tab. Cross-tab writes are not atomic.
    let singleDatabaseSettingsHost = null;
    let singleDatabaseSettingsOpening = false;
    let singleDatabaseInitialization = null;
    let singleDatabaseSettingsUi = null;
    let singleDatabaseSettingsStatus = '';

    const IS_ZENDESK =
        location.hostname.endsWith('.zendesk.com');

    const IS_SOLIDGATE =
        location.hostname === 'hub.solidgate.com';

    // Solidgate drawer segmentation follows references/solidgate-country.txt.
    const COUNTRY_SELECTORS = [
        '[data-testid="order-details-drawer_ip-country_value"]',
        '[data-testid="order-details-drawer_geo-country_value"]',
        '[data-testid="order-details-drawer_card-issuer-country_value"]',
        '[data-testid="order-details-drawer_country_value"]',

        '[data-testid="order-details-drawer-summary_ip-country_value"]',
        '[data-testid="order-details-drawer-summary_geo-country_value"]',
        '[data-testid="order-details-drawer-summary_card-issuer-country_value"]',
        '[data-testid="order-details-drawer-summary_country_value"]'
    ];

    const DESCRIPTION_SELECTORS = [
        '[data-testid="order-details-drawer_description_value"]',
        '[data-testid="order-details-drawer-summary_description_value"]'
    ];

    const BLACK_COUNTRIES = new Set([
        'USA', 'CYP', 'UKR', 'PRI', 'GUM', 'VIR', 'MNP', 'ASM', 'UMI'
    ]);

    const RED_COUNTRIES = BLACK_COUNTRIES;

    const YELLOW_COUNTRIES = new Set([
        'GBR', 'AUS', 'CAN', 'FRA', 'NLD', 'CHE', 'LUX', 'DNK', 'SWE', 'BEL', 'DEU'
    ]);

    const SEGMENT_STYLES = {
        black: {
            background: 'rgba(0, 0, 0, 0.16)',
            border: '2px solid #000000'
        },
        red: {
            background: 'rgba(245, 41, 27, 0.22)',
            border: '2px solid #f5291b'
        },
        yellow: {
            background: 'rgba(250, 231, 17, 0.35)',
            border: '2px solid #fae711'
        }
    };

    function getCurrentProduct() {
        const descriptionEl = DESCRIPTION_SELECTORS
        .map(selector => document.querySelector(selector))
        .find(Boolean);

        const description = normalize(descriptionEl?.textContent);

        if (description.startsWith('pdf guru')) return 'pdfguru';
        if (description.startsWith('pdfleader')) return 'pdfleader';
        if (description.startsWith('thebestpdf')) return 'thebestpdf';
        if (description.startsWith('resumeleader')) return 'resumeleader';

        return '';
    }

    function normalize(value) {
        return (value || '').trim().toLowerCase();
    }

    function normalizeCountry(value) {
        return (value || '').trim().toUpperCase();
    }

    function getCountryElements() {
        return COUNTRY_SELECTORS.flatMap(selector => [...document.querySelectorAll(selector)]);
    }

    function getVisibleCountries() {
        return getCountryElements()
            .map(el => normalizeCountry(el.textContent))
            .filter(Boolean);
    }

    function detectSegment() {
        const product = getCurrentProduct();
        const countries = getVisibleCountries();

        const hasGlobalBlackCountry = countries.includes('UKR') || countries.includes('USA');
        const hasBlackCountry = countries.some(country => BLACK_COUNTRIES.has(country));
        const hasYellowCountry = countries.some(country => YELLOW_COUNTRIES.has(country));

        // UKR and USA force the global black segment, including on red-segment products.
        // Keep this before product rules: mixed-country fields depend on it.
        if (hasGlobalBlackCountry) {
            return 'black';
        }

        if (product === 'pdfguru' && hasBlackCountry) {
            return 'black';
        }

        if (
            ['thebestpdf', 'pdfleader', 'resumeleader'].includes(product) &&
            hasBlackCountry
        ) {
            return 'red';
        }

        if (hasYellowCountry) {
            return 'yellow';
        }

        return null;
    }

    function resetElement(el) {
        el.style.background = '';
        el.style.border = '';
        el.style.borderRadius = '';
        el.style.padding = '';
        el.style.boxShadow = '';
        el.style.display = '';
    }

    function applyStyle(el, segment) {
        const style = SEGMENT_STYLES[segment];

        if (!style) {
            resetElement(el);
            return;
        }

        el.style.background = style.background;
        el.style.border = style.border;
        el.style.borderRadius = '4px';
        el.style.padding = '2px 6px';
        el.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.05)';
        el.style.display = 'inline-block';
    }

    function scanCountries() {
        const segment = detectSegment();
        const product = getCurrentProduct();
        const countryElements = getCountryElements();

        countryElements.forEach(el => {
            const country = normalizeCountry(el.textContent);

            resetElement(el);

            if (!segment || !country) return;

            if (country === 'UKR' || country === 'USA') {
                applyStyle(el, 'black');
                return;
            }

            if (
                segment === 'black' &&
                product === 'pdfguru' &&
                BLACK_COUNTRIES.has(country)
            ) {
                applyStyle(el, 'black');
            }

            if (
                segment === 'red' &&
                RED_COUNTRIES.has(country)
            ) {
                applyStyle(el, 'red');
            }

            if (
                segment === 'yellow' &&
                YELLOW_COUNTRIES.has(country)
            ) {
                applyStyle(el, 'yellow');
            }
        });
    }

    const COLORS = {
        otherEmail: "background: rgba(0, 184, 212, 0.18); border: 2px solid #00b8d4; border-radius: 4px;",
        russianEmail: "background: rgba(255, 152, 0, 0.18); border: 2px solid #ff9800; border-radius: 4px;",
        sensitiveData: "background: rgba(155, 89, 255, 0.22); border: 2px solid #9b59ff; border-radius: 4px;"
    };

    const DATA_DELETION_TRIGGERS = [
        "Cancel the account",
        "Stop Account",
        "cancellation of any subscription or account",
        "account and subscription is fully cancelled",
        "cancel my mail",
        "cancel my acount",
        "account closure",
        "cancellation of any associated account",
        "unsubscribe from the system",
        "unsubscribe from my account",
        "remove my card details",
        "permanently deactivated",
        "removal of my credit card",
        "payment details have been removed",
        "account is closed",
        "my account and subscription are fully terminated",
        "remove my payment details",
        "account is cancelled",
        "payment method linked to my account be removed",
        "removed my card details",
        "account has been closed",
        "cancel that account",
        "account has been fully closed",
        "account has been canceled",
        "cancel my registration",
        "cancelled my account",
        "unsubscribe my account",
        "delete",
        "cancel any account",
        "cancellation of any account",
        "account permanently closed",
        "payment information be removed",
        "deleted",
        "Delete my bank details",
        "cancel an account",
        "remove my credit card",
        "remove my payment method",
        "account to be deleted",
        "remove my banking details",
        "account be deleted",
        "opt out completely",
        "account canceled",
        "cancel my user",
        "permanently removed",
        "unsubscribe my registration",
        "delete my credit card",
        "Delete my all details",
        "Delete the account",
        "cancel this account",
        "Cancellation of Account",
        "my account has been cancelled",
        "delete all personal data",
        "remove me",
        "removal of my registration",
        "closure of my account",
        "delete all records",
        "account was cancelled",
        "Cancelamento de conta",
        "remove all my data",
        "Remove all",
        "eliminate my account",
        "Delete my data",
        "Erase my profile",
        "Remove my account",
        "Close my account",
        "Opt-out completely",
        "Wipe my data",
        "Data deletion request",
        "Right to be forgotten",
        "GDPR erasure request",
        "Peace out",
        "Take my data with you",
        "Forget my credit card details",
        "Delete my info",
        "Remove my card information",
        "Take off me of your list",
        "I no longer consent to data collection",
        "Delete my pdfguru account",
        "Account cancellation",
        "delete my account",
        "remove my details",
        "account terminated",
        "terminate my account",
        "Cancel account",
        "stop my account",
        "removal of all my personal data",
        "deletion of my data",
        "cancellation of my data",
        "cancellation of my account",
        "account  has been fully unsubscribed",
        "Cancel my account",
        "delete the my account",
        "cancel my app",
        "deactivate my account",
        "deletion of my personal data",
        "deletion",
        "account is canceled",
        "delete my card details",
        "cancellation of the account",
        "Please cancel my PDF GURU account",
        "remove all my credit card details",
        "everything deleted",
        "account closed",
        "unlist my card",
        "cancelling the account",
        "cancellation of my subscription and account",
        "account to be closed",
        "Cancel please my account",
        "removal of my banking data",
        "cancel my payment account",
        "cancell my account",
        "account to be cancelled",
        "discontinue PDF Guru account",
        "have been removed",
        "has been removed",
        "TERMINATION OF ACCOUNT",
        "Deleting",
        "removal of",
        "disconnect my account",
        "is removed",
        "erease",
        "remove",
        "CANCEL ME",
        "removed",
        "take me off",
        "cancel all my accounts",
        "cancel my subscription and account",
        "account has been completely deactivated",
        "cancellation of access",
        "close the account",
        "cancellation of any/all accounts",
        "account has been fully cancelled",
        "close account",
        "purged",
        "take my card off",
        "termination of my acount",
        "details scrubbed",
        "close that account",
        "cancelar mi cuenta",
        "account to be discatived",
        "remoge my card",
        "cancellation of any registration",
        "cancellation of my subscription/account",
        "cancel any cards",
        "disassociation",
        "Cancel Subscription & Account",
        "deactivation of",
        "account in not active",
        "Cancel Charge and Account",
        "unsubscribe my profile",
        "annullare l’iscrizione del mio profilo",
        "cancellation of an account",
        "cancelacion de la cuenta",
        "Removal",
        "Cancel register",
        "Block my profile",
        "closing",
        "unlink",
        "canceling this account",
        "Cancelation of account",
        "Cancel our account",
        "cancellation of this account",
        "cancellation of my payment details",
        "ELIMINAR M ICUENTA",
        "cancel my personal account",
        "account is fully canceled",
        "unsubscribe from this account",
        "credit card cancellation",
        "CANCELLATION OF PAYMENT DATA",
        "cancellation of all data",
        "discard any information",
        "cancel the registration",
        "suspender la cuenta",
        "canceling my account",
        "cancellation of my personal data",
        "fully closed",
        "Cancelación de cuenta",
        "Account kündigen",
        "cancellare il mio account",
        "account is fully cancelled",
        "make my information desappear",
        "cancel any registration",
        "close any accounts",
        "cancel any associated account",
        "eliminazione account",
        "gelöscht",
        "borren",
        "account has been fully deactivated",
        "cancel any accounts",
        "löschen",
        "cancel my payment/account",
        "get rid of",
        "account is indeed deactivated",
        "account is fully terminated",
        "closure",
        "CANCELACIÓN CUENTA",
        "cancel your account",
        "Get me out of your system",
        "Cancelar cuenta",
        "closed",
        "removes the payment method",
        "de baja mi cuenta",
        "cancel my billing account",
        "wipe",
        "PERSONAL DATA BE CANCELED",
        "cancelar a minha conta",
        "erase",
        "cancellation of the service",
        "Cancel my acc",
        "BAJA DE LA CUENTA",
        "Cancele mi cuenta",
        "cancell the account",
        "usunięcie konta",
        "dati siano cancellati",
        "xoá tài khoản",
        "borrar",
        "cancellation of my profile",
        "information is cancelled",
        "account has been completely canceled",
        "account to be canceled",
        "cancel any profile",
        "termination of any account",
        "cancel my data",
        "cease any subscription or account",
        "close this account",
        "data deactivated"
    ];

    const G1_TRIGGERS = [
        "Competition and Consumer Commission",
        "ACCC",
        "Competition and Market Authority",
        "Authority for Consumers and Markets",
        "ACM",
        "European Consumer Centre",
        "Scamwatch",
        "National Anti-Scam Centre",
        "NASC",
        "Arbeiterkammer",
        "Abteilung Konsumentenschutz",
        "Procuradoria de Proteção e Defesa do Consumidor",
        "PROCON",
        "consumidor.gov.br",
        "Association de Défense des Consommateurs de France",
        "Antifraud",
        "Action Fraud",
        "Latvian Consumer Protection Authority",
        "Consumer Rights Protection Centre",
        "CRPC",
        "National Consumer Affairs Center of Japan",
        "NCAC",
        "Worldwide Consumer Association",
        "Consumer Arbitration Committees",
        "Tüketici Hakem Heyeti",
        "BBC",
        "Watchdog",
        "European Consumer Center",
        "ECC-Net",
        "trust pilot",
        "FTC",
        "Federal Trade Commission",
        "Competition and Consumer Protection Commission",
        "CCPC",
        "Autorité de la Concurrence",
        "Autorità Garante della Concorrenza e del Mercato",
        "AGCM",
        "Office for Competition and Consumer Protection",
        "UOKiK",
        "The Office of Fair Trading",
        "Trading Standards",
        "Direction Générale de la Concurrence",
        "de la Consommation",
        "et de la Répression des Fraudes",
        "DGCCRF",
        "Dirección General de Consumo",
        "Konsumentverket",
        "Consumer Protection Service Cyprus",
        "Υπηρεσία Προστασίας Καταναλωτή",
        "Consumentenautoriteit",
        "Oficinas Municipales de Información al Consumidor",
        "OMIC",
        "Organización de Consumidores y Usuarios",
        "OCU",
        "Europäisches Verbraucherzentrum",
        "Federal Association of Consumer Organizations",
        "Verbraucherzentrale Bundesverband",
        "VZBV",
        "Consumer Advice Center Baden-Württemberg",
        "Verbraucherzentrale Baden-Württemberg",
        "Hamburg Consumer Advice Center",
        "Verbraucherzentrale Hamburg",
        "Consumer Advice Center North Rhine-Westphalia",
        "Verbraucherzentrale Nordrhein-Westfalen",
        "Bavarian Consumer Center",
        "Verbraucherzentrale Bayern",
        "Consumer Service Bavaria in the Catholic German Women's Association",
        "VerbraucherService Bayern im Katholischen Deutschen Frauenbund",
        "Verbraucherzentrale",
        "Consumer Advice Center",
        "Rada Reklamy Biuro",
        "Information Commissioner’s Office",
        "ICO",
        "Commission Nationale de l'Informatique et des Libertés",
        "CNIL",
        "Bundesanstalt für Verbraucherschutz und Lebensmittelsicherheit",
        "BVL",
        "German Environmental Aid Association",
        "Deutsche Umwelthilfe",
        "Trustpilot",
        "Cancer",
        "Autism",
        "Dementia",
        "Dyslexia",
        "Alzheimer",
        "Depression",
        "mental",
        "death",
        "died",
        "dead",
        "Tide",
        "Rocket Money",
        "Subaio",
        "Tsunami",
        "Tornado",
        "Earthquake",
        "Wildfire",
        "I am a minor",
        "ECC",
        "war",
        "Advertising Standards Authority",
        "ASA",
        "Cyprus Advertising Regulation Organization",
        "CARO",
        "European Advertising Standards Alliance",
        "EASA",
        "Consumer Affairs",
        "Consumer Affairs Agency",
        "CAA",
        "Consumer Rights Protection Authority",
        "VVTAT",
        "International Consumer Protection and Enforcement Network",
        "ICPEN",
        "SignalConso",
        "Conso",
        "European Consumer Centres",
        "promise a refund",
        "within 1 day",
        "within a day",
        "According to your PayPal",
        "suicidal",
        "suicide",
        "TINA",
        "TINA.org",
        "Truth in Advertising",
        "truthinadvertising",
        "truthinadvertising.org",
        "EU Consumer Protection Centre",
        "consumer advice centre",
        "CCPS",
        "Cyprus Consumer Protection Service",
        "National Life Center",
        "NLC",
        "National Life Center in Japan",
        "Lithuanian State Consumer Rights Protection Authority",
        "Consumer Protection Service of Cyprus"
    ];

    const G2_TRIGGERS = [
        "ask Paypal",
        "through PayPal",
        "called my bank",
        "report to Amex",
        "notified my bank",
        "contacting my bank",
        "with the bank",
        "disputed the charge",
        "contact with the bank",
        "open fraud case",
        "take up this issue with bank",
        "hands of Paypal",
        "card issuer",
        "contact my credit company",
        "inform my bank",
        "through the bank",
        "will be contesting",
        "buyer protection",
        "thru my banking institution",
        "contacting the bank",
        "contact the credit card",
        "PayPal was also informed",
        "informed my bank",
        "reporting to PayPal",
        "through my bank",
        "chargeback request",
        "via my payment provider",
        "with my payment provider",
        "pursue the refund via my payment provider",
        "will go back to PayPal",
        "to my credit card provider",
        "report it as fraud to the credit card",
        "instructed my bank to decline the charge",
        "complaint to my financial institution",
        "complaint with the bank",
        "to my cc company",
        "reported you to my cc",
        "contacted American Express",
        "claim with PayPal",
        "report this to PAYPAL",
        "contacted the bank",
        "reporting to you to PayPal",
        "money back from PayPal",
        "reversal via PayPal",
        "contacting my banking",
        "through my payment provider",
        "with our bank",
        "with my bank",
        "involve my bank",
        "proceed through PayPal",
        "ask Paypall",
        "asked my bank",
        "to the bank",
        "to my bank",
        "contact Chase",
        "will ask my credit card",
        "report the matter to my bank",
        "process via PayPal",
        "inform my financial institution",
        "credit card company",
        "pursue the matter further through my payment provider",
        "complain about the case via PayPal",
        "call my bank",
        "claim through my bank",
        "escalate this matter through my bank",
        "touch with my Credit Card Company",
        "will be requesting a refund directly through my card provider",
        "contacted my bank",
        "taking up this matter with my bank",
        "go to my bank",
        "proceed to file a formal clarification with my bank",
        "contacted my credit company",
        "report it to my bank",
        "report this to my bank",
        "escalate the matter through my bank/card",
        "bank has been notified",
        "escalated through my bank",
        "report the charge as fraudulent",
        "escalate the case with my bank",
        "flagged by the bank",
        "disputing",
        "escalated through PayPal",
        "contact with my bank",
        "escalate this matter through my credit card",
        "Report as scam",
        "Report as fraud",
        "called the bank",
        "make a dispute",
        "Make a chargeback",
        "Contact my bank",
        "Contact my credit card",
        "Contact my card issuer",
        "Contact my financial institution",
        "Return with my bank",
        "Return on my own",
        "Return by my own",
        "Reverse charges",
        "Recall charges",
        "Contact PayPal",
        "PayPal buyer protection",
        "Report to Google Play",
        "Report to App Store",
        "marked it as fraud",
        "notified it as fraud",
        "dispute",
        "chargeback",
        "disputing this charge",
        "chargebacks",
        "reported to my bank",
        "complaint with my bank",
        "complaints to my bank",
        "complaint with my credit card issuer",
        "I will notify my bank",
        "I will be going to Paypal",
        "escalating the matter through my payment provider",
        "PayPal case",
        "escalate it through my bank",
        "escalate the matter to the relevant payment platform",
        "informed the bank",
        "calling my credit card",
        "with my credit card",
        "complaint with PayPal",
        "reported you for fraud",
        "cases at PayPal",
        "take it to pay pall",
        "contact Mastercard",
        "informed AMEX",
        "file a payment refusal",
        "with the card company",
        "PayPal claim",
        "forward this to Papal",
        "report this as fraud",
        "mark it as fraude",
        "mark it as fraud",
        "report the transaction via PayPal",
        "report for fraud",
        "complaint on PayPal",
        "conflict with PayPal",
        "block the payment with Amex",
        "flagged it as FRAUD",
        "through my card provider",
        "report it immediately to Pay PAL",
        "tell the bank",
        "steps via PayPal",
        "case via PayPal",
        "disputed",
        "this to Paypal",
        "this through PalPal",
        "commissioned PayPal",
        "banks fraud department",
        "through AMEX",
        "calling my bank",
        "report it to Pay Pal",
        "reported to PayPal",
        "ask the bank",
        "report you for fraud",
        "PayPal’s Resolution Center",
        "ask refund via PayPal",
        "take it up with PayPal",
        "case with PayPal",
        "Will advise American Express",
        "case to PayPal",
        "issue in PayPal",
        "contact Pay Pal",
        "PayPal to get the money",
        "raising via paypal",
        "through Pay Pal",
        "Resolution Center",
        "CONTACTED PAYPAL",
        "fraud department of my bank",
        "turn on PayPal",
        "ACTION VIA BANK",
        "inform Paypal",
        "reporting as fraud",
        "contact the bank",
        "alerted PayPal",
        "I will contest",
        "informing Paypal",
        "informing my bank",
        "call AMEX",
        "complaint to PayPal",
        "go to PayPal",
        "COMPLAINTED WITH PAYPAL",
        "complaint via PayPal",
        "PayPal resolution centre",
        "fraud form at the bank",
        "file an appeal",
        "report the mater to Visa",
        "claim it in the bank",
        "claim from my bank",
        "report it to PayPal",
        "bank will get involved",
        "escalating thru PayPal",
        "pass this onto PayPal",
        "onto PayPal",
        "override this with PayPal",
        "report the problem to PayPal",
        "escalate to PayPal",
        "further with PayPal",
        "take this up with my financial institution",
        "inform PayPay",
        "tell PayPal",
        "reporting you to PayPal",
        "report the transaction via the PayPal",
        "contacting PayPal",
        "filing FRAUD",
        "refund from PayPal",
        "bank will be in contact",
        "go directly to paypal",
        "call in PayPal",
        "credit card provider",
        "goes to PayPal",
        "sent to PayPal",
        "instruct my bank",
        "with my banking institution",
        "notified the bank",
        "complaints to paypal",
        "Paypal involved",
        "problem to PayPal",
        "opening a refund file",
        "report to PayPal",
        "start a conflict",
        "ask for it at the bank",
        "issue with Paypal",
        "informed Paypal",
        "contact the banking",
        "cancel via PayPal",
        "fight these charges",
        "with the credit union",
        "contest these charges",
        "notify my bank",
        "to my credit card company",
        "will oppose this payment",
        "call to bank",
        "share it with Paypal",
        "report on PayPal",
        "instructed the card issuing bank",
        "Purchase Protection",
        "complaint with my cc",
        "report fraud",
        "claim to Mastercard",
        "claim at my bank",
        "reclaim ammount at paypal",
        "I will reclaim ammount",
        "bank's legal department",
        "bank take care",
        "case in paypal",
        "reporting this to my credit card",
        "PayPal has been informed",
        "challenge this transaction",
        "notifying my bank",
        "file a fraud complaint",
        "file an objection",
        "reported it as fraud",
        "report it to bank"
    ];

    const POLICIES_TRIGGERS = [
        "30-day",
        "guarantee",
        "exercise my",
        "right of 14 days",
        "withdrawal from",
        "Widerrufs",
        "Wiederruf",
        "within 14 days",
        "european union",
        "right to cancel",
        "money back guarantee",
        "Wiederrufe",
        "still within the 14days",
        "Wiederuf",
        "Kündigung",
        "Kundigung",
        "Widerrufsrecht",
        "Widerruf",
        "Withdrawal Form",
        "EU",
        "resident",
        "14-day",
        "right of withdrawal",
        "withdraw from",
        "citizen",
        "refund policy",
        "revoke",
        "withdrawal from the purchase",
        "right to withdraw",
        "cooling-off",
        "two weeks cool down",
        "widerrufe",
        "right to request",
        "14 days to cancel",
        "withdrawal period",
        "legal deadline",
        "withdrawing from my contract",
        "cooling off",
        "legal right",
        "Money Back Policy",
        "withdraw form my contract",
        "Eurepean",
        "trete hiermit von meinem Vertrag zurück",
        "right to regret",
        "have 14 days",
        "14-day right",
        "withdrawing from the contract",
        "period of 14 days",
        "legal period",
        "of 14 days",
        "14 days to get the refund",
        "withdrawal letter",
        "right to withdrawal",
        "withdrawel from",
        "14 legal days",
        "withdrawing from",
        "contract withdrawal",
        "European Economic Area"
    ];

    const CANCEL_INTENT_WORDS = [
        "cancel",
        "canceled",
        "cancelled",
        "canceling",
        "cancelling",
        "cancellation",
        "cancelation",

        "cancle",
        "cancled",
        "canceld",
        "cancell",
        "canel",
        "canelled",
        "cancl",
        "cnacel",
        "cacnel",

        "unsubscribe",
        "unsubscribed",
        "unsubscribing",
        "unsubscription",
        "un-subscribe",

        "unsubcribe",
        "unsubcribed",
        "unsubscrib",
        "unsuscribe",
        "unsuscribed",
        "unsbscribe",

        "terminate",
        "terminated",
        "terminating",
        "termination",

        "terminte",
        "terminat",
        "termiante",
        "termianted",

        "discontinue",
        "discontinued",
        "discontinuing",
        "discontinuation",

        "cease",
        "ceased",
        "ceasing",

        "suspend",
        "suspended",
        "suspending",
        "suspension",

        "deactivate",
        "deactivated",
        "deactivating",
        "deactivation",

        "opt out",
        "opt-out",
        "optout",
        "opt me out",

        "do not renew",
        "don't renew",
        "dont renew",
        "not renew",
        "no renewal",

        "disable renewal",
        "disable auto renewal",
        "disable auto-renew",
        "disable autorenew",

        "turn off renewal",
        "turn off auto renewal",
        "turn off auto-renew",
        "turn off autorenew",

        "stop renewal",
        "stop auto renewal",
        "stop auto-renew",
        "stop autorenew",

        "stop charging",
        "stop billing",
        "stop recurring",
        "stop subscription",
        "stop membership",
        "stop plan",

        "end subscription",
        "end membership",
        "end plan",
        "end trial",

        "halt subscription",
        "halt membership",
        "halt billing",

        "close subscription",
        "close membership",

        "no more charges",
        "no further charges",
        "no future charges",
        "no more payments",
        "no further payments",
        "no future payments",

        "do not charge me",
        "don't charge me",
        "dont charge me",
        "do not bill me",
        "don't bill me",
        "dont bill me"
    ];

    const REFUND_INTENT_WORDS = [
        "refund",
        "refunds",
        "refunded",
        "refunding",

        "refound",
        "refun",
        "refud",
        "refnd",
        "refuned",
        "refundd",
        "reufnd",
        "reund",
        "rfund",
        "refnud",
        "refumd",

        "reimburse",
        "reimbursed",
        "reimbursing",
        "reimbursement",

        "reimburs",
        "reimbursment",
        "reimbursemet",
        "reimbuse",

        "repay",
        "repaid",
        "repaying",
        "repayment",

        "reverse",
        "reversed",
        "reversing",
        "reversal",

        "return",
        "returned",
        "returning",

        "recredit",
        "recredited",
        "re-credit",
        "re-credited",

        "money back",
        "give back",
        "send back",
        "pay back",
        "credit back",
        "restitution",
        "restitute",
        "recoup",
        "recouped",
        "recompense",
        "recompensed"
    ];

    const DEFAULT_IGNORED_OTHER_EMAILS = new Set([
        'billing@pdf.contact',
        'billing@pdfguru.com',
        'billing@pdfleader.com',
        'billing@pdfmaster.app',
        'contact@pdfguru.com',
        'contact@pdfmaster.app',
        'customer.care@pdfguru.com',
        'customer.care@pdfleader.com',
        'customer.care@thebestpdf.com',
        'dmytro.kanievskyi@pdfguru.com',
        'feedback@pdf.contact',
        'feedback@pdfguru.com',
        'feedback@thebestpdf.com',
        'headsupport@pdfleader.com',
        'headsupport@resumeleader.com',
        'help@leaderdocs.limited',
        'help@pdf.contact',
        'help@pdfguru.com',
        'help@pdfleader.com',
        'help@pdfmaster.app',
        'help@thebestpdf.com',
        'info@pdfguru.com',
        'info@pdfmaster.app',
        'info@thebestpdf.com',
        'marketing@thebestpdf.com',
        'paypal@resumeleader.com',
        'paypal@thebestpdf.com',
        'refund@leaderdocs.limited',
        'refund@pdf.contact',
        'refund@pdfguru.com',
        'refund@pdfleader.com',
        'refund@pdfmaster.app',
        'refund@thebestpdf.com',
        'sales@thebestpdf.com',
        'social@pdfguru.com',
        'social@pdfleader.com',
        'social@thebestpdf.com',
        'support.ua@pdfguru.com',
        'support@leaderdocs.limited',
        'support@pdf.contact',
        'support@pdfcalls2.zendesk.com',
        'support@pdfguru.com',
        'support@pdfguru.zendesk.com',
        'support@pdfleader.com',
        'support@pdfmaster.app',
        'support@pdfvoicemails.zendesk.com',
        'support@resumeleader.com',
        'support@thebestpdf.com',
        'suport@pdfguru.com',
        "mail@hello.pdfleader.com",
        "support@solidgate.com",
        "tech@thebestpdf.com",
        "tech@pdfleader.com"
    ]);

    const RUSSIAN_EMAIL_DOMAINS = [
        "mail.ru",
        "bk.ru",
        "inbox.ru",
        "list.ru",
        "yandex.ru",
        "ya.ru",
        "rambler.ru"
    ];

    const TRIGGER_SETTINGS_SCHEMA_VERSION = 1;
    // Conversion-only format; no live storage or initialization uses it yet.
    const TRIGGER_DATABASE_SCHEMA_VERSION = 2;
    const TRIGGER_DATABASE_STORAGE_KEY = 'zdHighlighterTriggerDatabase_v2';
    const TRIGGER_DATABASE_BACKUPS_STORAGE_KEY = 'zdHighlighterTriggerDatabaseBackups_v2';
    const FORMA_TEAM_UPGRADE_STORAGE_KEY = 'zdHighlighterFormaCategoryCorrection_v1';
    let triggerDatabaseSaveInProgress = false;
    const TRIGGER_SETTINGS_STORAGE_KEY =
        'zdHighlighterTriggerSettings_v1';
    const QC_PACKAGE_DRAFT_SCHEMA_VERSION = 1;
    const QC_PACKAGE_DRAFT_STORAGE_KEY =
        'zdHighlighterQcPackageDraft_v1';
    const QC_PACKAGE_EXPORT_FORMAT =
        'zendesk-highlighter-qc-package';
    const QC_PACKAGE_EXPORT_SCHEMA_VERSION = 1;
    const TRIGGER_SETTINGS_BACKUP_SCHEMA_VERSION = 1;
    const TRIGGER_SETTINGS_BACKUP_STORAGE_KEY =
        'zdHighlighterTriggerSettingsBackups_v1';

    const PROTECTED_TRIGGER_CATEGORIES = Object.freeze({
        g1: Object.freeze({ id: 'g1', behavior: 'trigger' }),
        g2: Object.freeze({ id: 'g2', behavior: 'trigger' }),
        policies: Object.freeze({ id: 'policies', behavior: 'trigger' }),
        dataDeletion: Object.freeze({
            id: 'data-deletion',
            behavior: 'deletion'
        }),
        cancelIntent: Object.freeze({
            id: 'cancel-intent',
            behavior: 'cancel'
        }),
        refundIntent: Object.freeze({
            id: 'refund-intent',
            behavior: 'refund'
        })
    });

    function cloneTriggerSettings(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function createDefaultPhraseRecords(categoryId, phrases) {
        return phrases.map((text, index) => ({
            id: `${categoryId}-phrase-${String(index + 1).padStart(4, '0')}`,
            text
        }));
    }

    // Protected Forma trigger identities, in display order.
    const FORMA_TEAM_CATEGORIES = [
        { id: 'g1', label: 'G1', color: '#f5291b', phrases: G1_TRIGGERS },
        { id: 'g2', label: 'G2', color: '#fae711', phrases: G2_TRIGGERS },
        { id: 'policies', label: 'Policies', color: '#ff69b4', phrases: POLICIES_TRIGGERS }
    ];

    function createFormaTeamCategories() {
        return FORMA_TEAM_CATEGORIES.map(category => ({
            id: category.id, label: category.label, color: category.color, behavior: 'trigger',
            phrases: createDefaultPhraseRecords(category.id, category.phrases)
        }));
    }

    function createDefaultQcBase() {
        return {
            schemaVersion: TRIGGER_SETTINGS_SCHEMA_VERSION,
            packageId: 'built-in-defaults',
            packageVersion: '8.06',
            categories: [
                ...createFormaTeamCategories(),
                {
                    ...PROTECTED_TRIGGER_CATEGORIES.dataDeletion,
                    label: 'Data Deletion',
                    color: '#8b5e3c',
                    phrases: createDefaultPhraseRecords(
                        PROTECTED_TRIGGER_CATEGORIES.dataDeletion.id,
                        DATA_DELETION_TRIGGERS
                    )
                },
                {
                    ...PROTECTED_TRIGGER_CATEGORIES.cancelIntent,
                    label: 'Cancel',
                    color: '#ffc107',
                    phrases: createDefaultPhraseRecords(
                        PROTECTED_TRIGGER_CATEGORIES.cancelIntent.id,
                        CANCEL_INTENT_WORDS
                    )
                },
                {
                    ...PROTECTED_TRIGGER_CATEGORIES.refundIntent,
                    label: 'Refund',
                    color: '#2ecc71',
                    phrases: createDefaultPhraseRecords(
                        PROTECTED_TRIGGER_CATEGORIES.refundIntent.id,
                        REFUND_INTENT_WORDS
                    )
                }
            ]
        };
    }

    function createEmptyPersonalOverlay() {
        return {
            schemaVersion: TRIGGER_SETTINGS_SCHEMA_VERSION,
            categoryOverrides: {},
            phraseOverrides: {},
            phraseAdditions: {},
            categories: []
        };
    }

    function createDefaultTriggerSettings() {
        return {
            schemaVersion: TRIGGER_SETTINGS_SCHEMA_VERSION,
            qcBase: createDefaultQcBase(),
            personalOverlay: createEmptyPersonalOverlay()
        };
    }

    function triggerSettingsDataMatches(first, second) {
        if (first === second) return true;

        if (Array.isArray(first) || Array.isArray(second)) {
            return (
                Array.isArray(first) &&
                Array.isArray(second) &&
                first.length === second.length &&
                first.every((item, index) =>
                    triggerSettingsDataMatches(item, second[index])
                )
            );
        }

        if (!isPlainObject(first) || !isPlainObject(second)) {
            return false;
        }

        const firstKeys = Object.keys(first).sort();
        const secondKeys = Object.keys(second).sort();

        return (
            firstKeys.length === secondKeys.length &&
            firstKeys.every((key, index) => (
                key === secondKeys[index] &&
                triggerSettingsDataMatches(
                    first[key],
                    second[key]
                )
            ))
        );
    }

    function isPlainObject(value) {
        return (
            value !== null &&
            typeof value === 'object' &&
            !Array.isArray(value)
        );
    }

    function isValidTriggerColor(value) {
        return (
            typeof value === 'string' &&
            /^#[0-9a-f]{6}$/i.test(value)
        );
    }

    function validatePhraseRecords(phrases) {
        if (!Array.isArray(phrases)) return false;

        const ids = new Set();

        return phrases.every(phrase => {
            if (
                !isPlainObject(phrase) ||
                typeof phrase.id !== 'string' ||
                !phrase.id ||
                ids.has(phrase.id) ||
                typeof phrase.text !== 'string' ||
                !phrase.text.trim()
            ) {
                return false;
            }

            ids.add(phrase.id);
            return true;
        });
    }

    function addPhraseIdsToSet(phrases, phraseIds) {
        return phrases.every(phrase => {
            if (phraseIds.has(phrase.id)) return false;

            phraseIds.add(phrase.id);
            return true;
        });
    }

    function hasGloballyUniquePhraseIds(
        qcBase,
        personalOverlay
    ) {
        const phraseIds = new Set();

        for (const category of qcBase.categories) {
            if (!addPhraseIdsToSet(category.phrases, phraseIds)) {
                return false;
            }
        }

        for (const category of personalOverlay.categories) {
            if (!addPhraseIdsToSet(category.phrases, phraseIds)) {
                return false;
            }
        }

        for (const phrases of Object.values(
            personalOverlay.phraseAdditions || {}
        )) {
            if (!addPhraseIdsToSet(phrases, phraseIds)) {
                return false;
            }
        }

        return true;
    }

    function hasGloballyUniqueCategoryIds(
        qcBase,
        personalOverlay
    ) {
        const categoryIds = new Set(
            qcBase.categories.map(category => category.id)
        );

        for (const category of personalOverlay.categories) {
            if (categoryIds.has(category.id)) return false;

            categoryIds.add(category.id);
        }

        return true;
    }

    function validateTriggerCategory(category, categoryIds) {
        if (
            !isPlainObject(category) ||
            typeof category.id !== 'string' ||
            !category.id ||
            categoryIds.has(category.id) ||
            typeof category.label !== 'string' ||
            !category.label.trim() ||
            !isValidTriggerColor(category.color) ||
            !['trigger', 'deletion', 'cancel', 'refund'].includes(
                category.behavior
            ) ||
            !validatePhraseRecords(category.phrases)
        ) {
            return false;
        }

        categoryIds.add(category.id);
        return true;
    }

    function validateQcBase(qcBase) {
        if (
            !isPlainObject(qcBase) ||
            qcBase.schemaVersion !== TRIGGER_SETTINGS_SCHEMA_VERSION ||
            typeof qcBase.packageId !== 'string' ||
            !qcBase.packageId ||
            typeof qcBase.packageVersion !== 'string' ||
            !qcBase.packageVersion ||
            !Array.isArray(qcBase.categories)
        ) {
            return false;
        }

        const categoryIds = new Set();

        if (
            !qcBase.categories.every(category =>
                validateTriggerCategory(category, categoryIds)
            )
        ) {
            return false;
        }

        const phraseIds = new Set();

        if (
            !qcBase.categories.every(category =>
                addPhraseIdsToSet(
                    category.phrases,
                    phraseIds
                )
            )
        ) {
            return false;
        }

        const protectedByBehavior = new Map(
            Object.values(PROTECTED_TRIGGER_CATEGORIES).map(
                category => [category.behavior, category.id]
            ).filter(([behavior]) => behavior !== 'trigger')
        );

        if (
            qcBase.categories.some(category => {
                const protectedId = protectedByBehavior.get(
                    category.behavior
                );

                return (
                    protectedId !== undefined &&
                    category.id !== protectedId
                );
            })
        ) {
            return false;
        }

        return Object.values(PROTECTED_TRIGGER_CATEGORIES).every(
            protectedCategory => {
                const category = qcBase.categories.find(
                    item => item.id === protectedCategory.id
                );

                return (
                    category &&
                    category.behavior === protectedCategory.behavior
                );
            }
        );
    }

    function validatePersonalOverlay(personalOverlay) {
        if (
            !isPlainObject(personalOverlay) ||
            personalOverlay.schemaVersion !==
                TRIGGER_SETTINGS_SCHEMA_VERSION ||
            !isPlainObject(personalOverlay.categoryOverrides) ||
            !isPlainObject(personalOverlay.phraseOverrides) ||
            (
                personalOverlay.phraseAdditions !== undefined &&
                !isPlainObject(personalOverlay.phraseAdditions)
            ) ||
            !Array.isArray(personalOverlay.categories)
        ) {
            return false;
        }

        const protectedIds = new Set(
            Object.values(PROTECTED_TRIGGER_CATEGORIES).map(
                category => category.id
            )
        );

        const customCategoryIds = new Set();

        const customCategoriesValid =
            personalOverlay.categories.every(category => {
                if (
                    protectedIds.has(category?.id) ||
                    category?.behavior !== 'trigger'
                ) {
                    return false;
                }

                return validateTriggerCategory(
                    category,
                    customCategoryIds
                );
            });

        if (!customCategoriesValid) return false;

        const categoryOverridesValid = Object.entries(
            personalOverlay.categoryOverrides
        ).every(([categoryId, override]) => (
            !!categoryId &&
            isPlainObject(override) &&
            !Object.prototype.hasOwnProperty.call(
                override,
                'behavior'
            ) &&
            (
                override.label === undefined ||
                (
                    typeof override.label === 'string' &&
                    !!override.label.trim()
                )
            ) &&
            (
                override.color === undefined ||
                isValidTriggerColor(override.color)
            )
        ));

        if (!categoryOverridesValid) return false;

        const phraseAdditionsValid = Object.entries(
            personalOverlay.phraseAdditions || {}
        ).every(([categoryId, phrases]) => (
            !!categoryId &&
            validatePhraseRecords(phrases)
        ));

        if (!phraseAdditionsValid) return false;

        return Object.entries(
            personalOverlay.phraseOverrides
        ).every(([phraseId, override]) => (
            !!phraseId &&
            isPlainObject(override) &&
            (
                override.text === undefined ||
                (
                    typeof override.text === 'string' &&
                    !!override.text.trim()
                )
            ) &&
            (
                override.deleted === undefined ||
                typeof override.deleted === 'boolean'
            )
        ));
    }

    function validateCompleteTriggerSettings(settings) {
        return (
            isPlainObject(settings) &&
            Object.keys(settings).length === 3 &&
            ['schemaVersion', 'qcBase', 'personalOverlay'].every(
                key => Object.prototype.hasOwnProperty.call(
                    settings,
                    key
                )
            ) &&
            settings.schemaVersion ===
                TRIGGER_SETTINGS_SCHEMA_VERSION &&
            validateQcBase(settings.qcBase) &&
            validatePersonalOverlay(settings.personalOverlay) &&
            isPlainObject(
                settings.personalOverlay.phraseAdditions
            ) &&
            hasGloballyUniquePhraseIds(
                settings.qcBase,
                settings.personalOverlay
            ) &&
            hasGloballyUniqueCategoryIds(
                settings.qcBase,
                settings.personalOverlay
            )
        );
    }

    function validateTriggerSettingsBackup(backup) {
        return (
            isPlainObject(backup) &&
            Object.keys(backup).length === 5 &&
            [
                'schemaVersion',
                'id',
                'createdAt',
                'reason',
                'settings'
            ].every(key =>
                Object.prototype.hasOwnProperty.call(backup, key)
            ) &&
            backup.schemaVersion ===
                TRIGGER_SETTINGS_BACKUP_SCHEMA_VERSION &&
            typeof backup.id === 'string' &&
            !!backup.id &&
            typeof backup.createdAt === 'string' &&
            !Number.isNaN(Date.parse(backup.createdAt)) &&
            new Date(backup.createdAt).toISOString() ===
                backup.createdAt &&
            typeof backup.reason === 'string' &&
            !!backup.reason &&
            validateCompleteTriggerSettings(backup.settings)
        );
    }

    function validateTriggerSettingsBackupArchive(archive) {
        if (
            !isPlainObject(archive) ||
            Object.keys(archive).length !== 2 ||
            !Object.prototype.hasOwnProperty.call(
                archive,
                'schemaVersion'
            ) ||
            !Object.prototype.hasOwnProperty.call(
                archive,
                'backups'
            ) ||
            archive.schemaVersion !==
                TRIGGER_SETTINGS_BACKUP_SCHEMA_VERSION ||
            !Array.isArray(archive.backups)
        ) {
            return false;
        }

        const backupIds = new Set();

        return archive.backups.every(backup => {
            if (
                !validateTriggerSettingsBackup(backup) ||
                backupIds.has(backup.id)
            ) {
                return false;
            }

            backupIds.add(backup.id);
            return true;
        });
    }

    function createEmptyTriggerSettingsBackupArchive() {
        return {
            schemaVersion: TRIGGER_SETTINGS_BACKUP_SCHEMA_VERSION,
            backups: []
        };
    }

    function normalizeStoredTriggerSettings(value) {
        const defaults = createDefaultTriggerSettings();

        if (
            !isPlainObject(value) ||
            value.schemaVersion !== TRIGGER_SETTINGS_SCHEMA_VERSION
        ) {
            return {
                settings: defaults,
                usedFallback: true
            };
        }

        const qcBase = validateQcBase(value.qcBase)
            ? cloneTriggerSettings(value.qcBase)
            : defaults.qcBase;

        let personalOverlay;

        if (validatePersonalOverlay(value.personalOverlay)) {
            personalOverlay = cloneTriggerSettings(
                value.personalOverlay
            );

            if (!personalOverlay.phraseAdditions) {
                personalOverlay.phraseAdditions = {};
            }
        } else {
            personalOverlay = defaults.personalOverlay;
        }

        if (
            !hasGloballyUniquePhraseIds(
                qcBase,
                personalOverlay
            ) ||
            !hasGloballyUniqueCategoryIds(
                qcBase,
                personalOverlay
            )
        ) {
            personalOverlay = defaults.personalOverlay;
        }

        return {
            settings: {
                schemaVersion: TRIGGER_SETTINGS_SCHEMA_VERSION,
                qcBase,
                personalOverlay
            },
            usedFallback:
                qcBase === defaults.qcBase ||
                personalOverlay === defaults.personalOverlay
        };
    }

    async function readTriggerSettingsFromStorage() {
        if (
            typeof GM === 'undefined' ||
            typeof GM.getValue !== 'function'
        ) {
            console.warn(
                '[Zendesk Highlighter] GM storage is unavailable; using built-in trigger defaults.'
            );

            return createDefaultTriggerSettings();
        }

        try {
            const stored = await GM.getValue(
                TRIGGER_SETTINGS_STORAGE_KEY,
                null
            );

            if (stored === null || stored === undefined) {
                const defaults = createDefaultTriggerSettings();
                await writeTriggerSettingsToStorage(defaults);
                return defaults;
            }

            const result = normalizeStoredTriggerSettings(stored);

            if (result.usedFallback) {
                console.warn(
                    '[Zendesk Highlighter] Invalid saved trigger settings were ignored where necessary; safe defaults are active.'
                );
            }

            return result.settings;
        } catch (error) {
            console.warn(
                '[Zendesk Highlighter] Failed to load trigger settings; using built-in defaults.',
                error
            );

            return createDefaultTriggerSettings();
        }
    }

    async function writeTriggerSettingsToStorage(value) {
        if (
            !isPlainObject(value) ||
            !validateQcBase(value.qcBase) ||
            !validatePersonalOverlay(value.personalOverlay) ||
            !hasGloballyUniquePhraseIds(
                value.qcBase,
                value.personalOverlay
            ) ||
            !hasGloballyUniqueCategoryIds(
                value.qcBase,
                value.personalOverlay
            )
        ) {
            throw new Error(
                'Refusing to save trigger settings with invalid or duplicate IDs.'
            );
        }

        const result = normalizeStoredTriggerSettings(value);

        if (result.usedFallback) {
            throw new Error('Refusing to save invalid trigger settings.');
        }

        if (
            typeof GM === 'undefined' ||
            typeof GM.setValue !== 'function'
        ) {
            throw new Error('GM storage is unavailable.');
        }

        await GM.setValue(
            TRIGGER_SETTINGS_STORAGE_KEY,
            cloneTriggerSettings(result.settings)
        );
    }

    async function readStoredTriggerSettingsExactly() {
        if (
            typeof GM === 'undefined' ||
            typeof GM.getValue !== 'function'
        ) {
            throw new Error('GM storage is unavailable.');
        }

        const stored = await GM.getValue(
            TRIGGER_SETTINGS_STORAGE_KEY,
            null
        );

        if (!validateCompleteTriggerSettings(stored)) {
            throw new Error(
                'The saved trigger settings failed verification.'
            );
        }

        return cloneTriggerSettings(stored);
    }

    async function readTriggerSettingsBackupArchiveFromStorage() {
        if (
            typeof GM === 'undefined' ||
            typeof GM.getValue !== 'function'
        ) {
            throw new Error('GM storage is unavailable.');
        }

        const stored = await GM.getValue(
            TRIGGER_SETTINGS_BACKUP_STORAGE_KEY,
            null
        );

        if (stored === null || stored === undefined) {
            return createEmptyTriggerSettingsBackupArchive();
        }

        if (!validateTriggerSettingsBackupArchive(stored)) {
            throw new Error(
                'The saved backup archive is invalid and was left unchanged.'
            );
        }

        return cloneTriggerSettings(stored);
    }

    function createTriggerSettingsBackupId(archive) {
        const existingIds = new Set(
            archive.backups.map(backup => backup.id)
        );
        let backupId;

        do {
            triggerSettingsBackupIdSequence++;
            backupId = `settings-backup-${Date.now().toString(36)}-${triggerSettingsBackupIdSequence.toString(36)}`;
        } while (existingIds.has(backupId));

        return backupId;
    }

    async function appendVerifiedTriggerSettingsBackup(
        settings,
        reason
    ) {
        if (!validateCompleteTriggerSettings(settings)) {
            throw new Error(
                'The trigger settings are invalid and cannot be backed up.'
            );
        }

        if (
            typeof GM === 'undefined' ||
            typeof GM.setValue !== 'function'
        ) {
            throw new Error('GM storage is unavailable.');
        }

        const archive =
            await readTriggerSettingsBackupArchiveFromStorage();
        const backup = {
            schemaVersion: TRIGGER_SETTINGS_BACKUP_SCHEMA_VERSION,
            id: createTriggerSettingsBackupId(archive),
            createdAt: new Date().toISOString(),
            reason,
            settings: cloneTriggerSettings(settings)
        };

        if (!validateTriggerSettingsBackup(backup)) {
            throw new Error(
                'The new settings backup failed validation.'
            );
        }

        const nextArchive = cloneTriggerSettings(archive);
        nextArchive.backups.push(backup);

        if (!validateTriggerSettingsBackupArchive(nextArchive)) {
            throw new Error(
                'The updated backup archive failed validation.'
            );
        }

        await GM.setValue(
            TRIGGER_SETTINGS_BACKUP_STORAGE_KEY,
            cloneTriggerSettings(nextArchive)
        );

        const verifiedArchive =
            await readTriggerSettingsBackupArchiveFromStorage();

        if (
            !triggerSettingsDataMatches(
                verifiedArchive,
                nextArchive
            )
        ) {
            throw new Error(
                'The saved backup did not match the intended data.'
            );
        }

        return {
            archive: verifiedArchive,
            backup: cloneTriggerSettings(backup)
        };
    }

    function validateQcPackageDraft(qcBase) {
        return (
            validateQcBase(qcBase) &&
            (
                qcBase.description === undefined ||
                typeof qcBase.description === 'string'
            )
        );
    }

    function normalizeStoredQcPackageDraft(value) {
        if (
            !isPlainObject(value) ||
            value.schemaVersion !== QC_PACKAGE_DRAFT_SCHEMA_VERSION ||
            !validateQcPackageDraft(value.qcBase)
        ) {
            return null;
        }

        return cloneTriggerSettings(value.qcBase);
    }

    async function readQcPackageDraftFromStorage() {
        if (
            typeof GM === 'undefined' ||
            typeof GM.getValue !== 'function'
        ) {
            throw new Error('GM storage is unavailable.');
        }

        const stored = await GM.getValue(
            QC_PACKAGE_DRAFT_STORAGE_KEY,
            null
        );

        if (stored === null || stored === undefined) return null;

        const draft = normalizeStoredQcPackageDraft(stored);

        if (!draft) {
            console.warn(
                '[Zendesk Highlighter] Invalid saved QC package draft was ignored.'
            );
        }

        return draft;
    }

    async function writeQcPackageDraftToStorage(qcBase) {
        if (!validateQcPackageDraft(qcBase)) {
            throw new Error('Refusing to save an invalid QC package draft.');
        }

        if (
            typeof GM === 'undefined' ||
            typeof GM.setValue !== 'function'
        ) {
            throw new Error('GM storage is unavailable.');
        }

        await GM.setValue(QC_PACKAGE_DRAFT_STORAGE_KEY, {
            schemaVersion: QC_PACKAGE_DRAFT_SCHEMA_VERSION,
            qcBase: cloneTriggerSettings(qcBase)
        });
    }

    async function clearQcPackageDraftStorage() {
        if (
            typeof GM === 'undefined' ||
            typeof GM.setValue !== 'function'
        ) {
            throw new Error('GM storage is unavailable.');
        }

        await GM.setValue(QC_PACKAGE_DRAFT_STORAGE_KEY, null);
    }

    let triggerSettingsState = null;


    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function makeRegexList(words) {
        const uniqueWords = [...new Set(words.map(w => w.trim()).filter(Boolean))];

        return uniqueWords.map(word => {
            const escaped = escapeRegex(word);

            if (/^[A-Za-z0-9]+$/.test(word)) {
                return new RegExp(`\\b${escaped}\\b`, 'gi');
            }

            const startsWord = /^[A-Za-z0-9]/.test(word);
            const endsWord = /[A-Za-z0-9]$/.test(word);

            const prefix = startsWord ? '\\b' : '';
            const suffix = endsWord ? '\\b' : '';

            return new RegExp(`${prefix}${escaped}${suffix}`, 'gi');
        });
    }

    let activeIgnoredEmails = new Set(DEFAULT_IGNORED_OTHER_EMAILS);
    let allPatterns = [];
    let effectiveTriggerCategories = [];
    let effectiveCategoryById = new Map();
    let categoryHighlightNames = new Map();
    let zendeskTriggerSettingsInitialized = false;

    const HIGHLIGHT_NAMES = {
        otherEmail: 'zd-hl-other-email',
        russianEmail: 'zd-hl-russian-email',
        sensitiveData: 'zd-hl-sensitive-data'
    };

    function applyPhraseOverrides(phrases, phraseOverrides) {
        return phrases.flatMap(phrase => {
            const override = phraseOverrides[phrase.id];

            if (override?.deleted) return [];

            return [{
                ...phrase,
                text: override?.text ?? phrase.text
            }];
        });
    }

    function buildEffectiveTriggerCategories(settings) {
        const qcBase = settings.qcBase;
        const personalOverlay = settings.personalOverlay;
        const categoryOverrides =
            personalOverlay.categoryOverrides || {};
        const phraseOverrides =
            personalOverlay.phraseOverrides || {};
        const phraseAdditions =
            personalOverlay.phraseAdditions || {};

        const categories = qcBase.categories.map(category => {
            const categoryOverride =
                categoryOverrides[category.id] || {};

            return {
                ...category,
                label:
                    categoryOverride.label ??
                    category.label,
                color:
                    categoryOverride.color ??
                    category.color,
                phrases: [
                    ...applyPhraseOverrides(
                        category.phrases,
                        phraseOverrides
                    ),
                    ...cloneTriggerSettings(
                        phraseAdditions[category.id] || []
                    )
                ]
            };
        });

        const existingCategoryIds = new Set(
            categories.map(category => category.id)
        );

        personalOverlay.categories.forEach(category => {
            if (existingCategoryIds.has(category.id)) {
                console.warn(
                    `[Zendesk Highlighter] Personal category "${category.id}" conflicts with a QC category and was ignored.`
                );
                return;
            }

            const categoryOverride =
                categoryOverrides[category.id] || {};

            categories.push({
                ...cloneTriggerSettings(category),
                label:
                    categoryOverride.label ??
                    category.label,
                color:
                    categoryOverride.color ??
                    category.color,
                phrases: [
                    ...applyPhraseOverrides(
                        category.phrases,
                        phraseOverrides
                    ),
                    ...cloneTriggerSettings(
                        phraseAdditions[category.id] || []
                    )
                ]
            });

            existingCategoryIds.add(category.id);
        });

        return categories;
    }

    function isDenseTriggerDatabaseArray(value) {
        if (!Array.isArray(value)) return false;
        for (let index = 0; index < value.length; index++) {
            if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
        }
        return true;
    }

    function isValidIgnoredEmail(value) {
        return typeof value === 'string' && /^[A-Z0-9_%+-]+(?:[.][A-Z0-9_%+-]+)*@(?:[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?[.])+[A-Z]{2,}$/i.test(value.trim());
    }

    function defaultIgnoredEmails() {
        return createDefaultPhraseRecords('ignored-email', [...DEFAULT_IGNORED_OTHER_EMAILS].map(normalizeEmail));
    }

    function databaseSections(database) {
        return [...database.categories, { id: 'ignored-emails', label: 'Ignored emails', phrases: database.ignoredEmails }];
    }

    function validateTriggerDatabase(database, allowPrevious = false) {
        const hasExactKeys = (value, keys) => (
            isPlainObject(value) &&
            Object.keys(value).length === keys.length &&
            keys.every(key => Object.prototype.hasOwnProperty.call(value, key))
        );

        if (
            !hasExactKeys(database, ['schemaVersion', 'categories', ...(database && Object.hasOwn(database, 'ignoredEmails') ? ['ignoredEmails'] : [])]) ||
            database.schemaVersion !== TRIGGER_DATABASE_SCHEMA_VERSION ||
            !isDenseTriggerDatabaseArray(database.categories)
        ) {
            return false;
        }

        const categoryIds = new Set(['ignored-emails']);
        const phraseIds = new Set();
        if (Object.hasOwn(database, 'ignoredEmails')) {
            const emails = database.ignoredEmails;
            if (!isDenseTriggerDatabaseArray(emails) || !validatePhraseRecords(emails) ||
                !emails.every(item => hasExactKeys(item, ['id', 'text']) && isValidIgnoredEmail(item.text)) ||
                new Set(emails.map(item => normalizeEmail(item.text))).size !== emails.length ||
                !addPhraseIdsToSet(emails, phraseIds)) return false;
        }
        const previousModel = allowPrevious && database.categories.some(category => category?.id === 'general');
        if (!previousModel && database.categories.some(category => category?.id === 'general')) return false;
        const protectedCategories = previousModel
            ? [{ id: 'general', behavior: 'trigger' }, ...Object.values(PROTECTED_TRIGGER_CATEGORIES).filter(c => c.behavior !== 'trigger')]
            : Object.values(PROTECTED_TRIGGER_CATEGORIES);

        for (const category of database.categories) {
            if (
                !isPlainObject(category) ||
                !hasExactKeys(category, ['id', 'label', 'color', 'behavior', 'phrases',
                    ...(Object.prototype.hasOwnProperty.call(category, 'opacity') ? ['opacity'] : []),
                    ...(Object.prototype.hasOwnProperty.call(category, 'highlightsVisible') ? ['highlightsVisible'] : [])]) ||
                (Object.prototype.hasOwnProperty.call(category, 'opacity') && !isValidCategoryOpacity(category.opacity)) ||
                (Object.prototype.hasOwnProperty.call(category, 'highlightsVisible') && typeof category.highlightsVisible !== 'boolean') ||
                !isDenseTriggerDatabaseArray(category.phrases) ||
                !validateTriggerCategory(category, categoryIds) ||
                !category.phrases.every(phrase => hasExactKeys(phrase, ['id', 'text'])) ||
                !addPhraseIdsToSet(category.phrases, phraseIds)
            ) {
                return false;
            }

            if (
                category.behavior !== 'trigger' &&
                !protectedCategories.some(protectedCategory => (
                    protectedCategory.id === category.id &&
                    protectedCategory.behavior === category.behavior
                ))
            ) {
                return false;
            }
        }

        return protectedCategories.every(protectedCategory =>
            database.categories.some(category => (
                category.id === protectedCategory.id &&
                category.behavior === protectedCategory.behavior
            ))
        );
    }

    // Pure conversion only: callers must retain legacy history separately before
    // any future activation. Hidden/orphaned data and QC drafts are not triggers.
    function convertLegacyTriggerSettingsToDatabase(settings) {
        // Older valid overlays can omit phraseAdditions. Do not use the legacy
        // fallback normalizer here: invalid settings must never become defaults.
        const candidate = isPlainObject(settings) &&
            isPlainObject(settings.personalOverlay) &&
            settings.personalOverlay.phraseAdditions === undefined
            ? {
                ...settings,
                personalOverlay: {
                    ...settings.personalOverlay,
                    phraseAdditions: {}
                }
            }
            : settings;

        if (!validateCompleteTriggerSettings(candidate)) {
            throw new Error('Cannot convert invalid legacy trigger settings.');
        }

        const database = {
            schemaVersion: TRIGGER_DATABASE_SCHEMA_VERSION,
            categories: buildEffectiveTriggerCategories(candidate).map(category => ({
                id: category.id,
                label: category.label,
                color: category.color,
                opacity: getCategoryAlpha(category),
                highlightsVisible: category.highlightsVisible !== false,
                behavior: category.behavior,
                phrases: category.phrases.map(phrase => ({
                    id: phrase.id,
                    text: phrase.text
                }))
            }))
        };

        if (!validateTriggerDatabase(database)) {
            throw new Error('Converted trigger database failed validation.');
        }

        return snapshotTriggerDatabase(database);
    }

    // Stage 2 helpers are deliberately not called by any live workflow.
    // DEPLOYMENT BLOCKER: the entire transaction needs verified cross-tab
    // coordination, including backup archive updates and rollback. The local
    // guard and rereads below do not make any check/write sequence atomic.
    // null denotes an absent database, including a rolled-back first save.
    async function readTriggerDatabaseFromStorage() {
        if (typeof GM === 'undefined' || typeof GM.getValue !== 'function') {
            throw new Error('GM storage is unavailable.');
        }
        const stored = await GM.getValue(TRIGGER_DATABASE_STORAGE_KEY, null);
        if (stored === null) return null;
        if (!validateTriggerDatabase(stored, true)) {
            throw new Error('The stored trigger database is invalid; it was left unchanged.');
        }
        const snapshot = cloneTriggerSettings(stored);
        if (!validateTriggerDatabase(snapshot, true)) {
            throw new Error('The cloned trigger database is invalid; it was left unchanged.');
        }
        return snapshot;
    }

    async function readTriggerDatabaseBackupsFromStorage() {
        const archive = await GM.getValue(TRIGGER_DATABASE_BACKUPS_STORAGE_KEY, null);
        if (archive === null) return { schemaVersion: 1, backups: [] };
        const ids = new Set();
        if (
            !isPlainObject(archive) ||
            Object.keys(archive).length !== 2 ||
            archive.schemaVersion !== 1 ||
            !isDenseTriggerDatabaseArray(archive.backups) ||
            !archive.backups.every(backup => {
                if (
                    !isPlainObject(backup) ||
                    Object.keys(backup).length !== 3 ||
                    typeof backup.id !== 'string' || !backup.id || ids.has(backup.id) ||
                    typeof backup.createdAt !== 'string' ||
                    !Number.isFinite(Date.parse(backup.createdAt)) ||
                    new Date(backup.createdAt).toISOString() !== backup.createdAt ||
                    !validateTriggerDatabase(backup.database, true)
                ) return false;
                ids.add(backup.id);
                return true;
            })
        ) {
            throw new Error('The trigger database backup archive is invalid; it was left unchanged.');
        }
        return cloneTriggerSettings(archive);
    }

    async function saveTriggerDatabaseToStorage(database, { requireAbsent = false, beforeWrite = null, createBackup = true } = {}) {
        if (!validateTriggerDatabase(database)) {
            throw new Error('Refusing to save an invalid trigger database.');
        }
        if (triggerDatabaseSaveInProgress) {
            throw new Error('A trigger database save is already in progress.');
        }
        if (
            typeof GM === 'undefined' ||
            typeof GM.getValue !== 'function' || typeof GM.setValue !== 'function'
        ) {
            throw new Error('GM storage is unavailable.');
        }
        // Snapshot before the first await so caller edits cannot alter this save.
        const intended = snapshotTriggerDatabase(database);
        if (!validateTriggerDatabase(intended)) {
            throw new Error('Refusing to save an invalid cloned trigger database.');
        }
        triggerDatabaseSaveInProgress = true;
        let previous = null;
        let writeAttempted = false;
        try {
            previous = await readTriggerDatabaseFromStorage();
            if (requireAbsent && previous !== null) {
                throw new Error('A trigger database already exists; migration cannot replace it.');
            }
            if (previous !== null && createBackup) {
                const archive = await readTriggerDatabaseBackupsFromStorage();
                const ids = new Set(archive.backups.map(backup => backup.id));
                const baseId = `database-backup-${Date.now().toString(36)}`;
                let id = baseId;
                let suffix = 0;
                while (ids.has(id)) id = `${baseId}-${++suffix}`;
                archive.backups.push({
                    id,
                    createdAt: new Date().toISOString(),
                    database: cloneTriggerSettings(previous)
                });
                await GM.setValue(TRIGGER_DATABASE_BACKUPS_STORAGE_KEY, cloneTriggerSettings(archive));
                const verifiedArchive = await readTriggerDatabaseBackupsFromStorage();
                if (!triggerSettingsDataMatches(verifiedArchive, archive)) {
                    throw new Error('Trigger database backup verification failed.');
                }
            }
            if (beforeWrite) await beforeWrite();
            // Detect changes during backup creation; GM does not offer atomic CAS.
            if (!triggerSettingsDataMatches(await readTriggerDatabaseFromStorage(), previous)) {
                throw new Error('The trigger database changed before writing; save aborted.');
            }
            writeAttempted = true;
            await GM.setValue(TRIGGER_DATABASE_STORAGE_KEY, cloneTriggerSettings(intended));
            const verified = await readTriggerDatabaseFromStorage();
            if (!triggerSettingsDataMatches(verified, intended)) {
                throw new Error('Trigger database read-back verification failed.');
            }
            return verified;
        } catch (cause) {
            const error = new Error('Trigger database save failed.');
            error.cause = cause;
            error.rollbackAttempted = writeAttempted;
            error.rollbackVerified = false;
            if (writeAttempted) {
                try {
                    const current = await readTriggerDatabaseFromStorage();
                    if (!triggerSettingsDataMatches(current, previous)) {
                        if (!triggerSettingsDataMatches(current, intended)) {
                            error.concurrentChange = true;
                            throw new Error('Concurrent database change detected; rollback skipped. Recovery is required.');
                        }
                        // Still a check/write race: this is not cross-tab locking.
                        await GM.setValue(TRIGGER_DATABASE_STORAGE_KEY, cloneTriggerSettings(previous));
                        if (!triggerSettingsDataMatches(await readTriggerDatabaseFromStorage(), previous)) {
                            throw new Error('Trigger database rollback verification failed.');
                        }
                    }
                    error.rollbackVerified = true;
                    error.message += ' The previous database state was restored and verified.';
                } catch (rollbackError) {
                    error.rollbackError = rollbackError;
                    error.message += error.concurrentChange
                        ? ' Concurrent database change detected; rollback skipped. Recovery is required.'
                        : ' Rollback could not be verified; recovery is required.';
                }
            }
            // A verified rollback is still a failed save, never a success.
            throw error;
        } finally {
            triggerDatabaseSaveInProgress = false;
        }
    }

    // Stage 3: pure portable data and plans only; no live workflow callers.
    function snapshotTriggerDatabase(database) {
        if (!validateTriggerDatabase(database)) {
            throw new Error('Invalid trigger database.');
        }
        const snapshot = cloneTriggerSettings(database);
        if (snapshot.ignoredEmails === undefined) {
            const reserved = new Set(snapshot.categories.flatMap(category => category.phrases.map(phrase => phrase.id)));
            snapshot.ignoredEmails = defaultIgnoredEmails().map(item => ({ ...item, id: reserveFormaPhraseId(item.id, reserved) }));
        }
        snapshot.ignoredEmails.forEach(item => { item.text = normalizeEmail(item.text); });
        if (!validateTriggerDatabase(snapshot)) {
            throw new Error('Invalid cloned trigger database.');
        }
        const order = Object.values(PROTECTED_TRIGGER_CATEGORIES).map(category => category.id);
        snapshot.categories.sort((a, b) => {
            const rank = id => order.includes(id) ? order.indexOf(id) : order.length;
            return rank(a.id) - rank(b.id);
        });
        snapshot.categories.forEach(category => {
            category.opacity = getCategoryAlpha(category);
            // Missing in older records means visible; detection never uses this flag.
            category.highlightsVisible = category.highlightsVisible !== false;
        });
        return snapshot;
    }

    function exportTriggerDatabaseJson(database) {
        const snapshot = snapshotTriggerDatabase(database);
        return JSON.stringify({
            format: 'zendesk-highlighter-trigger-database',
            schemaVersion: 1,
            database: snapshot
        }, null, 2);
    }

    function parseTriggerDatabaseImportJson(json) {
        const value = JSON.parse(json);
        if (!isPlainObject(value)) throw new Error('Import must be a JSON object.');
        if (value.format === QC_PACKAGE_EXPORT_FORMAT) {
            if (!validateQcPackageExport(value)) throw new Error('Invalid legacy QC package.');
            // Old exports contain only their exported categories, never personal edits.
            return snapshotTriggerDatabase({
                schemaVersion: TRIGGER_DATABASE_SCHEMA_VERSION,
                categories: value.categories
            });
        }
        if (
            value.format !== 'zendesk-highlighter-trigger-database' ||
            value.schemaVersion !== 1 ||
            Object.keys(value).length !== 3 ||
            !Object.prototype.hasOwnProperty.call(value, 'database')
        ) throw new Error('Unsupported trigger database export format.');
        return snapshotTriggerDatabase(value.database);
    }

    function createFreeTriggerDatabaseId(original, reserved) {
        let suffix = 1;
        let id;
        do { id = `${original}-import-${suffix++}`; } while (reserved.has(id));
        reserved.add(id);
        return id;
    }

    function planTriggerDatabaseImport(currentDatabase, incomingDatabase, mode) {
        if (mode !== 'merge' && mode !== 'replace') throw new Error('Unsupported import mode.');
        const current = snapshotTriggerDatabase(currentDatabase);
        const incoming = snapshotTriggerDatabase(incomingDatabase);
        const next = cloneTriggerSettings(mode === 'replace' ? incoming : current);
        const mappings = [];
        const skippedPhrases = [];
        const remappedIds = [];
        const normalize = text => text.trim().toLowerCase();
        const protectedIds = new Set(Object.values(PROTECTED_TRIGGER_CATEGORIES).map(c => c.id));

        if (mode === 'merge') {
            const emailTexts = new Set(next.ignoredEmails.map(item => item.text));
            const reserved = new Set([...databaseSections(current), ...databaseSections(incoming)].flatMap(c => c.phrases.map(p => p.id)));
            const used = new Set(databaseSections(next).flatMap(c => c.phrases.map(p => p.id)));
            for (const item of incoming.ignoredEmails) {
                if (emailTexts.has(item.text)) continue;
                const id = used.has(item.id) ? createFreeTriggerDatabaseId(item.id, reserved) : item.id;
                next.ignoredEmails.push({ id, text: item.text }); used.add(id); emailTexts.add(item.text);
            }
            const categoryIds = new Set(current.categories.map(c => c.id));
            const phraseIds = new Set(databaseSections(next).flatMap(c => c.phrases.map(p => p.id)));
            // Reserve incoming IDs too, so generated IDs cannot steal later records' IDs.
            const reservedCategoryIds = new Set([...categoryIds, ...incoming.categories.map(c => c.id)]);
            const reservedPhraseIds = new Set([...phraseIds, ...incoming.categories.flatMap(c => c.phrases.map(p => p.id))]);
            for (const category of incoming.categories) {
                const matches = next.categories.filter(local => protectedIds.has(category.id)
                    ? local.id === category.id && local.behavior === category.behavior
                    : !protectedIds.has(local.id) && local.behavior === category.behavior &&
                        normalize(local.label) === normalize(category.label));
                if (matches.length > 1) {
                    throw new Error(`Ambiguous category match for "${category.label}" (${category.id}): ${matches.map(c => c.id).join(', ')}.`);
                }
                let target = matches[0];
                const added = !target;
                if (!target) {
                    const id = categoryIds.has(category.id)
                        ? createFreeTriggerDatabaseId(category.id, reservedCategoryIds) : category.id;
                    if (id !== category.id) remappedIds.push({ kind: 'category', from: category.id, to: id });
                    target = { ...category, id, phrases: [] };
                    next.categories.push(target);
                    categoryIds.add(id);
                }
                mappings.push({ incomingId: category.id, targetId: target.id, added });
                const texts = new Set(target.phrases.map(p => normalize(p.text)));
                for (const phrase of category.phrases) {
                    if (texts.has(normalize(phrase.text))) {
                        skippedPhrases.push({ categoryId: target.id, phrase: { ...phrase }, reason: 'Text already exists in this category' });
                        continue;
                    }
                    const id = phraseIds.has(phrase.id) ? createFreeTriggerDatabaseId(phrase.id, reservedPhraseIds) : phrase.id;
                    if (id !== phrase.id) remappedIds.push({ kind: 'phrase', categoryId: target.id, from: phrase.id, to: id });
                    target.phrases.push({ id, text: phrase.text });
                    phraseIds.add(id);
                    texts.add(normalize(phrase.text));
                }
            }
        }

        const result = snapshotTriggerDatabase(next);
        // Full before/after records expose metadata, edits, deletions, duplicate
        // records and phrase order; category order is listed separately.
        const changes = [];
        for (const before of databaseSections(current)) {
            const after = databaseSections(result).find(c => c.id === before.id);
            if (!after || !triggerSettingsDataMatches(before, after)) {
                changes.push({ type: after ? 'change' : 'delete', before, after: after || null });
            }
        }
        for (const after of databaseSections(result)) {
            if (!databaseSections(current).some(c => c.id === after.id)) {
                changes.push({ type: 'add', before: null, after });
            }
        }
        return cloneTriggerSettings({
            mode, currentDatabase: current, incomingDatabase: incoming, nextDatabase: result,
            preview: {
                changes, mappings, skippedPhrases, remappedIds,
                categoryOrderBefore: databaseSections(current).map(c => c.id),
                categoryOrderAfter: databaseSections(result).map(c => c.id)
            },
            isNoOp: triggerSettingsDataMatches(current, result)
        });
    }

    function reserveFormaPhraseId(id, reserved) {
        if (reserved.has(id)) return createFreeTriggerDatabaseId(id, reserved);
        reserved.add(id);
        return id;
    }

    function planFormaTeamUpgrade(database) {
        if (!validateTriggerDatabase(database, true)) throw new Error('Invalid previous Forma database.');
        const current = cloneTriggerSettings(database);
        const defaults = createDefaultQcBase().categories;
        const replaced = new Set(['g1', 'g2', 'policies', 'data-deletion']);
        const kept = current.categories.filter(category => category.id !== 'general' && !replaced.has(category.id));
        const reserved = new Set([...kept.flatMap(category => category.phrases.map(phrase => phrase.id)), ...(current.ignoredEmails || []).map(item => item.id)]);
        const categories = defaults.map(category => {
            const previous = current.categories.find(item => item.id === category.id);
            if (!replaced.has(category.id)) return previous || category;
            return { ...category, ...(previous || {}), id: category.id, label: category.label, behavior: category.behavior,
                phrases: category.phrases.map(phrase => ({
                    id: reserveFormaPhraseId(phrase.id, reserved), text: phrase.text
                })) };
        });
        const builtInIds = new Set(defaults.map(category => category.id));
        categories.push(...kept.filter(category => !builtInIds.has(category.id)));
        return snapshotTriggerDatabase({ schemaVersion: TRIGGER_DATABASE_SCHEMA_VERSION, categories, ...(current.ignoredEmails === undefined ? {} : { ignoredEmails: current.ignoredEmails }) });
    }

    // Restoring a pre-correction archive must not reactivate General or overwrite
    // the corrected phrase edits. Restore its appearance, intents and custom data,
    // retaining the current four corrected lists; the startup ledger is untouched.
    function prepareTriggerDatabaseRestore(backup, current) {
        if (validateTriggerDatabase(backup)) return snapshotTriggerDatabase(backup);
        if (!validateTriggerDatabase(backup, true)) throw new Error('Invalid backup database.');
        const next = cloneTriggerSettings(backup);
        const correctedIds = ['g1', 'g2', 'policies', 'data-deletion'];
        next.categories = next.categories.filter(category => category.id !== 'general' && !correctedIds.includes(category.id));
        for (const id of correctedIds) {
            const category = current.categories.find(item => item.id === id);
            const previous = backup.categories.find(item => item.id === id);
            next.categories.push({ ...cloneTriggerSettings(category), ...(previous || {}),
                id, behavior: category.behavior, phrases: cloneTriggerSettings(category.phrases) });
        }
        const reserved = new Set((next.ignoredEmails || []).map(item => item.id));
        next.categories.forEach(category => category.phrases.forEach(phrase => {
            phrase.id = reserveFormaPhraseId(phrase.id, reserved);
        }));
        return snapshotTriggerDatabase(next);
    }

    // This ledger is intentionally outside portable databases/backups: later user
    // deletions, imports and restores must not cause a completed upgrade to rerun.
    async function readFormaTeamUpgradeState() {
        const state = await GM.getValue(FORMA_TEAM_UPGRADE_STORAGE_KEY, null);
        if (state === null) return null;
        const complete = state?.status === 'complete';
        const keys = complete ? ['version', 'status'] : ['version', 'status', 'before', 'after'];
        if (!isPlainObject(state) || state.version !== 1 ||
            Object.keys(state).length !== keys.length || !keys.every(key => Object.hasOwn(state, key)) ||
            (!complete && (state.status !== 'pending' || !validateTriggerDatabase(state.before, true) || !validateTriggerDatabase(state.after)))) {
            throw new Error('Invalid Forma upgrade state; stored data was left unchanged.');
        }
        return cloneTriggerSettings(state);
    }

    async function writeVerifiedFormaTeamUpgradeState(next, expected) {
        if (!triggerSettingsDataMatches(await readFormaTeamUpgradeState(), expected)) {
            throw new Error('Forma upgrade state changed; startup stopped.');
        }
        await GM.setValue(FORMA_TEAM_UPGRADE_STORAGE_KEY, cloneTriggerSettings(next));
        if (!triggerSettingsDataMatches(await readFormaTeamUpgradeState(), next)) {
            throw new Error('Forma upgrade state verification failed.');
        }
    }

    async function ensureFormaTeamUpgrade(database) {
        let state = await readFormaTeamUpgradeState();
        if (state?.status === 'complete') return;
        const complete = { version: 1, status: 'complete' };
        if (state === null) {
            if (validateTriggerDatabase(database)) {
                // Fresh installs and already adapted databases need no database rewrite.
                await writeVerifiedFormaTeamUpgradeState(complete, null);
                return;
            }
            const pending = { version: 1, status: 'pending', before: cloneTriggerSettings(database),
                after: planFormaTeamUpgrade(database) };
            await writeVerifiedFormaTeamUpgradeState(pending, null);
            state = pending;
        }
        const current = await readTriggerDatabaseFromStorage();
        if (!triggerSettingsDataMatches(current, state.after)) {
            if (!triggerSettingsDataMatches(current, state.before)) {
                throw new Error('Database changed during the Forma upgrade; startup stopped without overwriting it.');
            }
            await saveTriggerDatabaseToStorage(state.after, {
                // The normal transaction verifies the backup, save and rollback.
                createBackup: true,
                beforeWrite: async () => {
                    if (!triggerSettingsDataMatches(await readTriggerDatabaseFromStorage(), state.before) ||
                        !triggerSettingsDataMatches(await readFormaTeamUpgradeState(), state)) {
                        throw new Error('Forma upgrade source changed; save aborted.');
                    }
                }
            });
        }
        // If interrupted after the verified database save, only finish the ledger;
        // never merge defaults again or create another backup on that restart.
        if (!triggerSettingsDataMatches(await readTriggerDatabaseFromStorage(), state.after)) {
            throw new Error('Forma upgrade result changed; startup stopped.');
        }
        const archive = await readTriggerDatabaseBackupsFromStorage();
        if (!archive.backups.some(backup => triggerSettingsDataMatches(backup.database, state.before))) {
            throw new Error('Forma upgrade backup is missing; startup stopped.');
        }
        await writeVerifiedFormaTeamUpgradeState(complete, state);
    }

    function revalidateTriggerDatabaseImportPlan(plan, currentDatabase, incomingDatabase) {
        // IDs use deterministic free suffixes, never time/randomness. Rebuilding
        // verifies the original mapping without replacing or mutating the plan.
        const expected = planTriggerDatabaseImport(currentDatabase, incomingDatabase, plan?.mode);
        if (!triggerSettingsDataMatches(plan, expected)) {
            throw new Error('Import plan or source databases changed; create a new preview.');
        }
        return true;
    }

    // Stage 4: pure CRUD. Operation types: add/edit/delete-phrase,
    // add/rename/recolor/delete-category. No caller may supply IDs or behaviors
    // for new records; existing identities and behaviors are retained.
    function editTriggerDatabase(database, operation) {
        const next = snapshotTriggerDatabase(database);
        if (!isPlainObject(operation)) throw new Error('Invalid database operation.');
        const fields = {
            'add-phrase': ['categoryId', 'text'],
            'edit-phrase': ['categoryId', 'phraseId', 'text'],
            'delete-phrase': ['categoryId', 'phraseId'],
            'add-category': ['label', 'color'],
            'rename-category': ['categoryId', 'label'],
            'recolor-category': ['categoryId', 'color'],
            'set-category-opacity': ['categoryId', 'opacity'],
            'set-category-visibility': ['categoryId', 'highlightsVisible'],
            'delete-category': ['categoryId']
        };
        if (!Object.prototype.hasOwnProperty.call(fields, operation.type)) {
            throw new Error('Unsupported database operation.');
        }
        const keys = ['type', ...fields[operation.type]];
        if (Object.keys(operation).length !== keys.length ||
            !keys.every(key => Object.prototype.hasOwnProperty.call(operation, key))) {
            throw new Error('Unexpected or missing database operation fields.');
        }
        const requiredText = value => {
            if (typeof value !== 'string' || !value.trim()) throw new Error('Text cannot be empty.');
            return value.trim();
        };
        const newId = kind => createFreeTriggerDatabaseId(kind, new Set(
            databaseSections(next).flatMap(category => [category.id, ...category.phrases.map(phrase => phrase.id)])
        ));
        if (operation.type === 'add-category') {
            const label = requiredText(operation.label);
            if (!isValidTriggerColor(operation.color)) throw new Error('Invalid category color.');
            next.categories.push({ id: newId('category'), label, color: operation.color, behavior: 'trigger', phrases: [] });
        } else {
            const category = databaseSections(next).find(item => item.id === operation.categoryId);
            if (!category) throw new Error('Category not found.');
            if (category.id === 'ignored-emails' && !['add-phrase', 'edit-phrase', 'delete-phrase'].includes(operation.type)) throw new Error('Protected system section.');
            if (operation.type === 'delete-category') {
                if (Object.values(PROTECTED_TRIGGER_CATEGORIES).some(item => item.id === category.id)) {
                    throw new Error('Protected categories cannot be deleted.');
                }
                next.categories = next.categories.filter(item => item.id !== category.id);
            } else if (operation.type === 'rename-category') {
                category.label = requiredText(operation.label);
            } else if (operation.type === 'set-category-visibility') {
                if (typeof operation.highlightsVisible !== 'boolean') throw new Error('Invalid highlight visibility.');
                category.highlightsVisible = operation.highlightsVisible;
            } else if (operation.type === 'set-category-opacity') {
                if (!isValidCategoryOpacity(operation.opacity)) throw new Error('Invalid category opacity.');
                category.opacity = operation.opacity;
            } else if (operation.type === 'recolor-category') {
                if (!isValidTriggerColor(operation.color)) throw new Error('Invalid category color.');
                category.color = operation.color;
            } else {
                const phrase = operation.type === 'add-phrase' ? null
                    : category.phrases.find(item => item.id === operation.phraseId);
                if (operation.type !== 'add-phrase' && !phrase) throw new Error('Phrase not found.');
                if (operation.type === 'delete-phrase') {
                    category.phrases = category.phrases.filter(item => item.id !== phrase.id);
                    if (category.id === 'ignored-emails') next.ignoredEmails = category.phrases;
                } else {
                    const text = category.id === 'ignored-emails' ? normalizeEmail(requiredText(operation.text)) : requiredText(operation.text);
                    if (category.id === 'ignored-emails' && !isValidIgnoredEmail(text)) throw new Error('Invalid email address.');
                    const normalized = text.toLowerCase();
                    // Editing an existing duplicate without changing its normalized
                    // text introduces no NEW duplicate, so allow that operation.
                    if ((!phrase || phrase.text.trim().toLowerCase() !== normalized) &&
                        category.phrases.some(item => item.id !== phrase?.id && item.text.trim().toLowerCase() === normalized)) {
                        throw new Error('Phrase text already exists in this category.');
                    }
                    if (phrase) phrase.text = text;
                    else category.phrases.push({ id: newId('phrase'), text });
                }
            }
        }
        return snapshotTriggerDatabase(next);
    }

    // Stage 5: disconnected migration controller. No startup or UI callers.
    function buildTriggerDatabaseMigrationPreview(legacySettings) {
        const database = convertLegacyTriggerSettingsToDatabase(legacySettings);
        const overlay = legacySettings.personalOverlay;
        const categories = [...legacySettings.qcBase.categories, ...overlay.categories];
        const categoryIds = new Set(categories.map(category => category.id));
        const phraseIds = new Set(categories.flatMap(category => category.phrases.map(phrase => phrase.id)));
        // Hidden base phrases still participate through their deletion overrides.
        // Additions in missing categories never enter the effective configuration.
        Object.entries(overlay.phraseAdditions || {}).forEach(([categoryId, phrases]) => {
            if (!categoryIds.has(categoryId)) return;
            phrases.forEach(phrase => phraseIds.add(phrase.id));
        });
        const excludedOrphans = {
            categoryOverrides: Object.entries(overlay.categoryOverrides).filter(([id]) => !categoryIds.has(id)),
            phraseOverrides: Object.entries(overlay.phraseOverrides).filter(([id]) => !phraseIds.has(id)),
            phraseAdditions: Object.entries(overlay.phraseAdditions || {}).filter(([id]) => !categoryIds.has(id))
        };
        return cloneTriggerSettings({
            legacySettings,
            database,
            counts: {
                categories: database.categories.length,
                phrases: database.categories.reduce((sum, category) => sum + category.phrases.length, 0),
                hiddenPhrases: categories.reduce((sum, category) => sum + category.phrases.filter(
                    phrase => overlay.phraseOverrides[phrase.id]?.deleted
                ).length, 0),
                orphanCategoryOverrides: excludedOrphans.categoryOverrides.length,
                orphanPhraseOverrides: excludedOrphans.phraseOverrides.length,
                orphanPhraseAdditions: excludedOrphans.phraseAdditions.reduce((sum, [, phrases]) => sum + phrases.length, 0)
            },
            excludedOrphans,
            note: 'Only current effective triggers will migrate. Hidden phrases and orphaned data remain in legacy storage. The QC draft is not included or changed.'
        });
    }

    async function ensureTriggerDatabaseMigrationTargetAbsent() {
        let database;
        try {
            database = await readTriggerDatabaseFromStorage();
        } catch (cause) {
            const error = new Error('Migration stopped: new database storage requires recovery.');
            error.cause = cause;
            throw error;
        }
        if (database !== null) throw new Error('A trigger database already exists; migration cannot replace it.');
    }

    async function prepareTriggerDatabaseMigration() {
        await ensureTriggerDatabaseMigrationTargetAbsent();
        // Strict reader: missing/invalid settings never become built-in defaults.
        const legacySettings = await readStoredTriggerSettingsExactly();
        return buildTriggerDatabaseMigrationPreview(legacySettings);
    }

    async function migrateTriggerDatabase(preview, confirmMigration) {
        if (typeof confirmMigration !== 'function') {
            throw new Error('An explicit migration confirmation callback is required.');
        }
        const snapshot = cloneTriggerSettings(preview);
        const verifyLegacyPreview = async () => {
            const current = await readStoredTriggerSettingsExactly();
            const expected = buildTriggerDatabaseMigrationPreview(current);
            if (!triggerSettingsDataMatches(snapshot, expected)) {
                throw new Error('Legacy settings or migration preview changed; create a new preview.');
            }
        };
        await ensureTriggerDatabaseMigrationTargetAbsent();
        await verifyLegacyPreview();
        // Pass a separate copy: the confirmation consumer cannot alter the plan.
        if (await confirmMigration(cloneTriggerSettings(snapshot)) !== true) {
            return { migrated: false, cancelled: true };
        }
        await ensureTriggerDatabaseMigrationTargetAbsent();
        await verifyLegacyPreview();
        const database = await saveTriggerDatabaseToStorage(snapshot.database, {
            requireAbsent: true,
            beforeWrite: verifyLegacyPreview
        });
        return { migrated: true, database };
    }

    // One editing Zendesk tab is supported. These checks and the per-instance
    // guard are not atomic cross-tab locking.
    async function createPersistentTriggerDatabaseSettingsUi(confirmAction, onVerified = null) {
        const initial = await readTriggerDatabaseFromStorage();
        if (!initial) throw new Error('No verified database exists.');
        const checkCurrent = async expected => {
            if (!triggerSettingsDataMatches(snapshotTriggerDatabase(await readTriggerDatabaseFromStorage()), snapshotTriggerDatabase(expected)))
                throw new Error('Stored database changed. Reload the Zendesk page (F5) before saving.');
        };
        const persistence = {
            backups: (await readTriggerDatabaseBackupsFromStorage()).backups,
            refreshHighlights: onVerified,
            async save(next, previous, { createBackup = true } = {}) {
                await checkCurrent(previous);
                const verified = await saveTriggerDatabaseToStorage(next, { createBackup, beforeWrite: () => checkCurrent(previous) });
                return verified;
            },
            async backup(previous) {
                if (triggerDatabaseSaveInProgress) throw new Error('A database operation is in progress.');
                triggerDatabaseSaveInProgress = true;
                try {
                    await checkCurrent(previous);
                    const archive = await readTriggerDatabaseBackupsFromStorage();
                    const id = createFreeTriggerDatabaseId('backup', new Set(archive.backups.map(item => item.id)));
                    archive.backups.push({ id, createdAt: new Date().toISOString(), database: snapshotTriggerDatabase(previous) });
                    await GM.setValue(TRIGGER_DATABASE_BACKUPS_STORAGE_KEY, cloneTriggerSettings(archive));
                    const verified = await readTriggerDatabaseBackupsFromStorage();
                    if (!triggerSettingsDataMatches(archive, verified)) throw new Error('Backup verification failed.');
                    return verified.backups;
                } finally { triggerDatabaseSaveInProgress = false; }
            },
            async restore(id, previous) {
                const archive = await readTriggerDatabaseBackupsFromStorage();
                const backup = archive.backups.find(item => item.id === id);
                if (!backup) throw new Error('Backup no longer exists.');
                return this.save(prepareTriggerDatabaseRestore(backup.database, previous), previous);
            },
            async listBackups() { return (await readTriggerDatabaseBackupsFromStorage()).backups; }
        };
        return createTriggerDatabaseSettingsUi(initial, confirmAction, persistence);
    }

    function refreshSingleDatabaseHighlights(database) {
        const ignoredEmails = new Set(snapshotTriggerDatabase(database).ignoredEmails.map(item => item.text));
        const configuration = buildTriggerConfigurationFromDatabase(database);
        // Remove previous category registrations before replacing configuration.
        if (window.CSS?.highlights) {
            categoryHighlightNames.forEach(name => CSS.highlights.delete(name));
        }
        activeIgnoredEmails = ignoredEmails;
        effectiveTriggerCategories = configuration.effectiveTriggerCategories;
        effectiveCategoryById = configuration.effectiveCategoryById;
        categoryHighlightNames = configuration.categoryHighlightNames;
        allPatterns = configuration.allPatterns;
        rebuildHighlightStyles();
        zendeskTriggerSettingsInitialized = true;
        scanAll();
    }

    async function openSingleDatabaseSettings() {
        if (!IS_ZENDESK) return;
        if (singleDatabaseSettingsHost) { singleDatabaseSettingsHost.style.display = 'block'; return; }
        if (singleDatabaseSettingsOpening) return;
        singleDatabaseSettingsOpening = true;
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;right:16px;top:24px;width:min(540px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;overscroll-behavior:contain;z-index:2147483647;background:#202124;color:#e8eaed;border:1px solid #44474e;border-radius:14px;box-shadow:0 16px 48px #0008;font:13px/1.5 system-ui,sans-serif;box-sizing:border-box;color-scheme:dark;';
        singleDatabaseSettingsHost = host;
        document.body.appendChild(host);
        const header = document.createElement('div');
        header.style.cssText = 'position:sticky;top:0;display:flex;align-items:center;gap:12px;padding:12px 16px;background:#27292e;border-bottom:1px solid #3d4047;z-index:2;';
        const title = document.createElement('strong'); title.textContent = 'Trigger settings';
        title.style.cssText = 'flex:1;min-width:0;font:600 17px/1.4 system-ui,sans-serif;color:#f1f3f4;';
        header.appendChild(title);
        const close = document.createElement('button'); close.textContent = 'Close';
        close.type = 'button';
        close.setAttribute('aria-label', 'Close settings');
        close.style.cssText = 'padding:6px 10px;border:1px solid #626773;border-radius:7px;background:#35383f;color:#f1f3f4;font:600 12px/1.5 system-ui;cursor:pointer;';
        close.onclick = () => { host.style.display = 'none'; };
        header.appendChild(close); host.appendChild(header);
        const content = document.createElement('div'); host.appendChild(content);
        content.style.cssText = 'padding:12px 14px 0;';
        const status = document.createElement('p'); host.appendChild(status);
        status.style.cssText = 'margin:0;padding:10px 16px 14px;color:#b7bdc8;font:12px/1.5 system-ui,sans-serif;overflow-wrap:anywhere;';
        const mount = async () => {
            await initializeZendeskTriggerSettings();
            if (singleDatabaseSettingsUi) content.replaceChildren(singleDatabaseSettingsUi.host);
            status.textContent = singleDatabaseSettingsStatus;
        };
        try {
            await mount();
        } catch (_) {
            status.textContent = 'Settings stopped: database loading, initialization, or verification failed. Highlighting was not activated. Recovery is required. Reload the Zendesk page (F5) after recovery.';
        } finally { singleDatabaseSettingsOpening = false; }
    }

    // UI factory: the caller supplies persistence and highlighting refresh,
    // then mounts the returned host. Tests can still use session-only state.
    function createTriggerDatabaseSettingsUi(initialDatabase, confirmAction = message => window.confirm(message), persistence = null) {
        let database = snapshotTriggerDatabase(initialDatabase);
        let incoming = null;
        let selectedImportFile = null;
        let mode = 'merge';
        let plan = null;
        let fileSequence = 0;
        let backups = persistence ? cloneTriggerSettings(persistence.backups) : [];
        let busy = false;
        let importFileInput = null;
        const pendingFields = new Map();
        const mountedFields = new Map();
        const disclosureState = new Map();
        const mountedDisclosures = new Map();
        const phraseViews = new Map();
        let undoDeletion = null;
        document.addEventListener?.('pointerdown', event => {
            const path = event.composedPath?.() || [];
            phraseViews.forEach(view => {
                if (view.adding && !path.includes(view.container) && !view.container?.contains?.(event.target)) view.cancelAdd?.();
            });
        }, true);
        const queuedFieldCommits = new Map();
        const fieldErrors = new Map();
        const drainFieldCommits = () => {
            if (busy || !queuedFieldCommits.size) return;
            const [key, commit] = queuedFieldCommits.entries().next().value;
            queuedFieldCommits.delete(key);
            void commit();
        };
        const fieldKey = (...parts) => JSON.stringify(parts);
        const capturePendingFields = () => {
            mountedFields.forEach(({ node, value }, key) => {
                if (node.value === value) pendingFields.delete(key);
                else pendingFields.set(key, node.value);
            });
        };
        const clearPendingFields = keys => keys.forEach(key => {
            pendingFields.delete(key);
            mountedFields.delete(key);
        });
        const discardWarning = () => {
            capturePendingFields();
            return pendingFields.size ? ' This will discard your unsaved field edits.' : '';
        };
        const host = document.createElement('div');
        const root = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
            :host { display:block; color:#e8eaed; font:13px/1.5 system-ui,sans-serif; color-scheme:dark; }
            * { box-sizing:border-box; } .panel { min-width:0; }
            [hidden] { display:none !important; }
            h3 { margin:14px 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#b7bdc8; }
            p { margin:8px 0; overflow-wrap:anywhere; } article { margin:8px 0; padding:12px; background:#2a2d33; border:1px solid #3b3f47; border-radius:10px; }
            .category-title { display:flex; align-items:center; gap:10px; font-size:15px; } .category-title strong { flex:1; overflow-wrap:anywhere; }
            details.category { margin:6px 0; background:#2a2d33; border:1px solid #3b3f47; border-radius:9px; overflow:hidden; }
            .category>.category-title { padding:10px 12px; font-size:13px; list-style:none; }
            .category>.category-title::-webkit-details-marker { display:none; }
            .category>.category-title::after { content:'›'; color:#b7bdc8; font-size:18px; }
            .category[open]>.category-title::after { transform:rotate(90deg); }
            .category-body { padding:0 10px 10px; border-top:1px solid #3b3f47; }
            .swatch { width:14px; height:14px; border-radius:50%; border:1px solid #0002; flex-shrink:0; }
            .count { background:#3a3f48; color:#dce1ea; border-radius:20px; padding:2px 8px; font-size:11px; white-space:nowrap; }
            .category-title .visibility-toggle { display:inline-flex; align-items:center; gap:5px; flex-shrink:0; padding:5px 7px; color:#dce1ea; }
            .visibility-eye { position:relative; display:inline-block; width:16px; height:10px; border:1.5px solid currentColor; border-radius:70% 20%; transform:rotate(45deg); }
            .visibility-eye::before { content:''; position:absolute; width:4px; height:4px; border-radius:50%; background:currentColor; left:4.5px; top:1.5px; }
            .visibility-toggle[data-hidden=true] .visibility-eye::after { content:''; position:absolute; width:20px; height:2px; background:currentColor; left:-3px; top:3px; }
            .row { display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin:8px 0; }
            input,select,button { font:inherit; border:1px solid #59616d; border-radius:7px; padding:7px 10px; color:inherit; background:#202329; max-width:100%; }
            input::placeholder { color:#aab2c0; } input[type=file] { width:100%; margin:8px 0; font-size:12px; }
            input::file-selector-button { background:#3b424e; color:#edf0f5; border:0; border-radius:4px; padding:5px 8px; margin-right:8px; cursor:pointer; }
            input[type=text] { flex:1 1 180px; min-width:0; } input[type=color] { width:42px; height:34px; padding:3px; }
            button { cursor:pointer; font-weight:600; font-size:12px; background:#383e48; } button:hover { filter:brightness(1.18); border-color:#aab6c8; }
            button.primary { background:#a8c7fa; border-color:#a8c7fa; color:#17253c; } button.danger { color:#ffb4ab; background:#402d31; border-color:#755057; }
            button.subtle { background:transparent; border-color:transparent; color:#b7bdc8; }
            :focus-visible { outline:2px solid #a8c7fa; outline-offset:2px; } :disabled { opacity:.55; cursor:wait; }
            details { margin:8px 0; } summary { cursor:pointer; padding:7px 0; font-weight:600; overflow-wrap:anywhere; }
            details[open]>summary { color:#a8c7fa; } details> .row { padding:10px; background:#23262c; border-radius:7px; }
            details.tool { background:#292c32; border:1px solid #404650; border-radius:10px; padding:6px 12px; } details.tool>summary { color:#d5e3fc; }
            .phrase-list { max-height:280px; overflow:auto; overscroll-behavior:contain; background:#1c1f24; border-radius:8px; scrollbar-color:#606977 #1c1f24; display:flex; flex-wrap:wrap; align-items:flex-start; align-content:flex-start; gap:5px; padding:8px; }
            .phrase-list>input.phrase-inline-input { flex:1 1 160px; min-width:min(180px,100%); width:180px; padding:4px 6px; border:1px solid #48505d; border-radius:4px; background:transparent; box-shadow:none; }
            .phrase-entry { display:flex; align-items:flex-start; max-width:100%; gap:4px; padding:2px 5px 2px 8px; background:#30353e; border:1px solid #48505d; border-radius:8px; box-shadow:inset 2px 0 var(--category-color); }
            .phrase-entry:hover { background:#3b424d; } .phrase-entry>button { flex-shrink:0; padding:1px 5px; border:0; background:transparent; font-size:16px; line-height:24px; }
            .phrase-entry:focus-within { border-color:#a8c7fa; } .phrase-entry input[type=checkbox] { margin:6px 2px 0 0; accent-color:#a8c7fa; }
            .phrase-edit { flex:1; min-width:0; margin:0; } .phrase-edit>summary { display:flex; gap:8px; align-items:baseline; font-weight:400; padding:4px 0; }
            .phrase-copy { flex:1; min-width:0; overflow-wrap:anywhere; } .edit-hint { color:#a8c7fa; font-size:12px; flex-shrink:0; }
            .import-preview { padding:10px; margin:10px 0; background:#1c2027; border-left:2px solid #7c9ac7; border-radius:5px; }
            .import-controls { display:flex; align-items:center; flex-wrap:wrap; gap:9px; margin:9px 0; }
            .import-controls>select { min-width:0; }
            .backup-entry { padding:10px 0; border-top:1px solid #404650; } .backup-entry>span { flex:1; min-width:0; overflow-wrap:anywhere; }
            ul { max-height:220px; overflow:auto; overscroll-behavior:contain; overflow-wrap:anywhere; padding-left:22px; } .muted { color:#b7bdc8; font-size:12px; }
            .status:not(:empty) { padding:10px; margin:10px 0; background:#293b51; border-radius:8px; } .status.error { color:#ffb4ab; background:#412c30; }
            @media(max-width:440px) { article { padding:10px; } .row { gap:5px; } button { padding:7px 8px; } }
        `;
        const panel = document.createElement('div'); panel.className = 'panel';
        root.append(style, panel);
        panel.addEventListener('keydown', event => event.stopPropagation());
        panel.addEventListener('keypress', event => event.stopPropagation());
        panel.addEventListener('keyup', event => event.stopPropagation());
        const el = (tag, text, parent) => {
            const node = document.createElement(tag);
            if (text !== undefined) node.textContent = text;
            if (parent) parent.appendChild(node);
            return node;
        };
        const row = parent => { const node = el('div', undefined, parent); node.className = 'row'; return node; };
        const disclosure = (parent, label, key, className = '') => {
            const node = el('details', undefined, parent);
            node.className = className;
            node.open = disclosureState.get(key) || false;
            el('summary', label, node);
            mountedDisclosures.set(key, node);
            return node;
        };
        let status;
        const message = (text, error = false) => { status.textContent = text; status.className = error ? 'status error' : 'status'; };
        const savedMessage = text => {
            // Persistence and UI state are already verified. Scanning cannot fail the save.
            try { persistence?.refreshHighlights?.(snapshotTriggerDatabase(database)); }
            catch (_) { text += ' Warning: highlighting refresh failed. Your changes are saved and verified. Reload the Zendesk page (F5).'; }
            message(text);
        };
        const runAction = async action => {
            if (busy) return;
            busy = true;
            if (importFileInput) importFileInput.disabled = true;
            mountedFields.forEach(({ node, lockWhileBusy = true }) => { node.disabled = lockWhileBusy; });
            try { await action(); }
            catch (_) { message('Operation failed. The stored data may have changed or verification failed. The last verified database remains displayed; pending edits were kept. Reload the Zendesk page (F5) before trying again.', true); }
            finally {
                busy = false;
                mountedFields.forEach(({ node }) => { node.disabled = false; });
                if (importFileInput) importFileInput.disabled = false;
                drainFieldCommits();
            }
        };
        const button = (parent, label, action) => {
            const node = el('button', label, parent); node.type = 'button';
            if (['Rename', 'Set color', 'Save phrase'].includes(label)) {
                node.textContent = 'Save'; node.setAttribute('aria-label', label);
            }
            node.className = /^(Delete|Restore)/.test(label) ? 'danger' : /^(Save|Add|Apply|Download)/.test(label) ? 'primary' : /^Cancel/.test(label) ? 'subtle' : '';
            node.addEventListener('click', () => runAction(action));
            return node;
        };
        const input = (parent, label, value = '', type = 'text') => {
            const node = el('input', undefined, parent); node.type = type; node.value = value;
            node.setAttribute('aria-label', label); node.placeholder = label; return node;
        };
        const pendingInput = (parent, label, value, type, key) => {
            const node = input(parent, label, pendingFields.has(key) ? pendingFields.get(key) : value, type);
            node.disabled = busy;
            mountedFields.set(key, { node, value });
            const discard = () => {
                capturePendingFields(); clearPendingFields([key]);
                node.value = value;
                mountedFields.set(key, { node, value });
                const editor = node.closest?.('details');
                if (editor) { editor.open = false; editor.querySelector('summary')?.focus(); }
                else node.focus?.();
            };
            node.addEventListener('keydown', event => {
                if (event.key === 'Escape' && !busy) { event.preventDefault(); fieldErrors.delete(key); queuedFieldCommits.delete(key); discard(); }
            });
            return node;
        };
        const autoCommit = (parent, node, key, operation) => {
            const note = el('span', fieldErrors.get(key) || '', parent);
            note.className = 'muted'; note.setAttribute('role', 'status');
            let inFlight = false;
            const commit = async () => {
                const field = mountedFields.get(key);
                if (!field || inFlight) return;
                const value = field.node.value;
                if (value.trim() === field.value) return;
                if (busy) { queuedFieldCommits.set(key, commit); return; }
                inFlight = true; busy = true;
                note.textContent = 'Saving…'; retry.hidden = true;
                try {
                    fieldErrors.delete(key);
                    await update(operation(value), [key]);
                    fieldErrors.delete(key);
                } catch (_) {
                    const error = 'Could not save. Check the value and retry.';
                    fieldErrors.set(key, error); render();
                } finally {
                    busy = false; inFlight = false;
                    mountedFields.forEach(({ node }) => { node.disabled = false; });
                    if (importFileInput) importFileInput.disabled = false;
                    drainFieldCommits();
                }
            };
            const retry = el('button', 'Retry', parent); retry.type = 'button';
            retry.setAttribute('aria-label', `Retry ${node.getAttribute?.('aria-label') || 'edit'}`);
            retry.hidden = !fieldErrors.has(key); retry.addEventListener('click', commit);
            node.addEventListener(['color', 'range'].includes(node.type) ? 'change' : 'blur', event => {
                // Moving to the picker must not commit a still-pending name.
                if (event.relatedTarget?.type === 'color') return;
                return commit();
            });
            node.addEventListener('keydown', async event => {
                if (event.isComposing) return;
                if (event.key === 'Enter') { event.preventDefault(); await commit(); }
                if (event.key === 'Escape' && !busy) {
                    event.preventDefault(); queuedFieldCommits.delete(key); fieldErrors.delete(key);
                    const field = mountedFields.get(key);
                    node.value = field.value; pendingFields.delete(key);
                    note.textContent = ''; retry.hidden = true;
                }
            });
        };
        const enterAdds = (node, action) => node.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); return action.click(); }
        });
        const refreshBackups = async () => {
            if (!persistence) return true;
            try { backups = await persistence.listBackups(); return true; }
            catch (_) { return false; }
        };
        const update = async (operation, savedKeys = []) => {
            capturePendingFields();
            if (operation.type === 'add-category' && databaseSections(database).some(category =>
                category.label.trim().toLowerCase() === operation.label.trim().toLowerCase())) {
                throw new Error('Category name already exists.');
            }
            const savedValues = new Map(savedKeys.map(key => [key, mountedFields.get(key)?.node.value]));
            const next = editTriggerDatabase(database, operation);
            const createBackup = operation.type === 'delete-category' &&
                database.categories.some(category => category.id === operation.categoryId && category.phrases.length > 0);
            if (!persistence && createBackup) saveBackup('Before category deletion');
            const verified = persistence ? await persistence.save(next, database, { createBackup }) : next;
            capturePendingFields();
            database = snapshotTriggerDatabase(verified);
            undoDeletion = null; phraseViews.forEach(view => view.selected.clear());
            clearPendingFields(savedKeys.filter(key => mountedFields.get(key)?.node.value === savedValues.get(key)));
            if (operation.type === 'add-phrase' && operation.categoryId !== 'ignored-emails' &&
                !pendingFields.has(fieldKey(operation.categoryId, 'new'))) {
                phraseViews.get(operation.categoryId).adding = false;
            }
            plan = null;
            const listed = await refreshBackups();
            render(); savedMessage(persistence ? (listed ? 'Saved and verified.' : 'Saved and verified; backup list could not refresh.') : 'Updated for this session.');
        };
        const saveBackup = label => { backups.push({ label, createdAt: new Date().toISOString(), database: snapshotTriggerDatabase(database) }); };
        const deletePhrases = async (category, ids, bulk) => {
            const current = databaseSections(database).find(item => item.id === category.id);
            if (!triggerSettingsDataMatches(current, category) || !ids.size ||
                [...ids].some(id => !current.phrases.some(phrase => phrase.id === id))) {
                throw new Error('Phrase selection changed.');
            }
            if (bulk && confirmAction(`Delete ${ids.size} phrases from “${category.label}”? Unsaved edits to these records will be discarded.`) !== true) return;
            capturePendingFields();
            const before = snapshotTriggerDatabase(database);
            const next = snapshotTriggerDatabase(database);
            const remaining = current.phrases.filter(phrase => !ids.has(phrase.id));
            if (category.id === 'ignored-emails') next.ignoredEmails = remaining;
            else next.categories.find(item => item.id === category.id).phrases = remaining;
            const validated = snapshotTriggerDatabase(next);
            if (!persistence && bulk) saveBackup('Before bulk deletion');
            const verified = persistence ? await persistence.save(validated, before, { createBackup: bulk }) : validated;
            database = snapshotTriggerDatabase(verified);
            undoDeletion = { before, after: snapshotTriggerDatabase(database) };
            clearPendingFields([...ids].map(id => fieldKey(category.id, 'phrase', id)));
            phraseViews.forEach(view => view.selected.clear());
            plan = null;
            const listed = await refreshBackups();
            render(); savedMessage(`Deleted ${ids.size} phrase${ids.size === 1 ? '' : 's'}.${persistence ? ' Saved and verified.' : ''}${listed ? '' : ' Backup list could not refresh.'} Undo is available until the next database change.`);
        };
        const phraseList = (parent, category, heading) => {
            el('strong', heading, parent);
            if (!category) { el('p', 'Category absent', parent); return; }
            el('p', `${category.label} · Color ${category.color} · Opacity ${Math.round(getCategoryAlpha(category) * 100)}% · Highlights ${category.highlightsVisible === false ? 'hidden' : 'visible'} · ${category.phrases.length} phrases`, parent);
            const list = el('ul', undefined, parent);
            category.phrases.forEach(phrase => el('li', phrase.text, list));
        };
        const previewImport = () => {
            plan = null;
            if (!incoming) { message('Select a valid JSON file first.', true); return; }
            try { plan = planTriggerDatabaseImport(database, incoming, mode); }
            catch (_) { render(); message('Cannot preview this import. Category names may match more than one category; rename them to make the destination clear.', true); return; }
            render();
        };
        function render() {
            // Restore keyboard position after rebuilding controls, including
            // repeated phrase buttons and fields with the same accessible name.
            const focusable = () => [...(root.querySelectorAll?.('button,input,select,summary') || [])];
            const focusLabel = node => node && `${node.tagName}:${node.getAttribute('data-visibility-category') || node.getAttribute('aria-label') || node.textContent}`;
            const active = root.activeElement;
            const activeLabel = focusLabel(active);
            const activeIndex = focusable().filter(node => focusLabel(node) === activeLabel).indexOf(active);
            capturePendingFields();
            mountedDisclosures.forEach((node, key) => disclosureState.set(key, node.open));
            mountedDisclosures.clear();
            mountedFields.clear();
            panel.replaceChildren();
            el('p', persistence ? 'Changes are saved only after storage verification. Unsaved fields are not included in exports or backups.' : 'Session preview: changes and backups here are not saved after closing or reloading.', panel).className = 'muted';
            status = el('div', '', panel); status.className = 'status'; status.setAttribute('role', 'status');
            if (undoDeletion) button(panel, 'Undo deletion', async () => {
                const undo = undoDeletion;
                if (!undo || !triggerSettingsDataMatches(database, undo.after)) throw new Error('Undo is stale.');
                const restored = persistence ? await persistence.save(undo.before, undo.after, { createBackup: false }) : undo.before;
                database = snapshotTriggerDatabase(restored); undoDeletion = null; plan = null;
                phraseViews.forEach(view => view.selected.clear());
                const listed = await refreshBackups(); render();
                savedMessage(`Deletion undone.${persistence ? ' Saved and verified.' : ''}${listed ? '' : ' Backup list could not refresh.'}`);
            });
            const list = el('section', undefined, panel); el('h3', 'Categories', list);
            databaseSections(database).forEach(category => {
                const ignored = category.id === 'ignored-emails';
                const addKey = fieldKey(category.id, 'new');
                const accordion = disclosure(list, '', fieldKey(category.id, 'category'), 'category');
                accordion.setAttribute('style', `--category-color:${ignored ? '#808080' : category.color}`);
                const title = accordion.children[0]; title.className = 'category-title';
                const card = el('div', undefined, accordion); card.className = 'category-body';
                if (!ignored) {
                    const swatch = el('span', undefined, title); swatch.className = 'swatch';
                    swatch.setAttribute('style', `background:${category.color}`);
                    swatch.setAttribute('aria-label', `Color ${category.color}`);
                }
                el('strong', category.label, title);
                el('span', `${category.phrases.length} ${ignored ? 'emails' : 'phrases'}`, title).className = 'count';
                if (!ignored) {
                    const visible = category.highlightsVisible !== false;
                    const visibilityLabel = `${visible ? 'Hide' : 'Show'} highlights: ${category.label}`;
                    const visibility = button(title, '', () => update({
                        type: 'set-category-visibility', categoryId: category.id, highlightsVisible: !visible
                }));
                visibility.className = 'visibility-toggle';
                visibility.setAttribute('data-visibility-category', category.id);
                visibility.setAttribute('aria-label', visibilityLabel);
                visibility.setAttribute('title', visibilityLabel);
                visibility.setAttribute('data-hidden', String(!visible));
                const eye = el('span', undefined, visibility); eye.className = 'visibility-eye'; eye.setAttribute('aria-hidden', 'true');
                if (!visible) el('span', 'Hidden', visibility).setAttribute('aria-hidden', 'true');
                // Cancel summary activation for pointer and keyboard-generated clicks.
                visibility.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); });
                const controls = row(disclosure(card, 'Edit category', fieldKey(category.id, 'settings')));
                const nameKey = fieldKey(category.id, 'name');
                const colorKey = fieldKey(category.id, 'color');
                const opacityKey = fieldKey(category.id, 'opacity');
                const name = pendingInput(controls, 'Category name', category.label, 'text', nameKey);
                autoCommit(controls, name, nameKey, value => ({ type: 'rename-category', categoryId: category.id, label: value }));
                const color = pendingInput(controls, 'Category color', category.color, 'color', colorKey);
                autoCommit(controls, color, colorKey, value => ({ type: 'recolor-category', categoryId: category.id, color: value }));
                const opacityControl = el('label', 'Opacity ', controls);
                const opacity = pendingInput(opacityControl, 'Highlight opacity', String(Math.round(getCategoryAlpha(category) * 100)), 'range', opacityKey);
                opacity.min = '0'; opacity.max = '100'; opacity.step = '1';
                opacity.setAttribute('style', 'width:100px;vertical-align:middle;padding:0');
                const percentage = el('span', `${opacity.value}%`, opacityControl);
                const showPercentage = () => { percentage.textContent = `${opacity.value}%`; };
                opacity.addEventListener('input', showPercentage);
                autoCommit(controls, opacity, opacityKey, value => ({ type: 'set-category-opacity', categoryId: category.id, opacity: Number(value) / 100 }));
                opacity.addEventListener('keydown', showPercentage);
                if (!Object.values(PROTECTED_TRIGGER_CATEGORIES).some(item => item.id === category.id)) {
                    button(controls, 'Delete category', () => {
                        if (confirmAction(`Delete “${category.label}” and its ${category.phrases.length} phrases? Unsaved edits in this category will be discarded.`) === true)
                            return update({ type: 'delete-category', categoryId: category.id }, [nameKey, colorKey, opacityKey, addKey, ...category.phrases.map(phrase => fieldKey(category.id, 'phrase', phrase.id))]);
                    });
                }
                }
                const phrases = el('div', undefined, card);
                if (!phraseViews.has(category.id)) phraseViews.set(category.id, { query: '', selecting: false, selected: new Set() });
                const view = phraseViews.get(category.id);
                const toolbar = row(phrases);
                const searchLabel = `Search ${ignored ? 'emails' : 'phrases'} in ${category.label}`;
                const search = input(toolbar, searchLabel, view.query);
                const count = el('span', '', phrases); count.setAttribute('role', 'status');
                const entries = [];
                const matches = phrase => phrase.text.toLowerCase().includes(view.query.toLowerCase());
                const filter = () => {
                    let total = 0;
                    entries.forEach(({ phrase, entry }) => { entry.hidden = !matches(phrase); if (!entry.hidden) total++; });
                    count.textContent = `${total} of ${category.phrases.length} phrases`;
                    empty.hidden = total !== 0;
                };
                search.addEventListener('input', () => { view.query = search.value; filter(); });
                search.addEventListener('keydown', event => {
                    if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); }
                    if (event.key === 'Escape') {
                        event.preventDefault(); view.query = ''; search.value = ''; filter();
                    }
                });
                button(toolbar, view.selecting ? 'Done selecting' : 'Select', () => { view.selecting = !view.selecting; render(); });
                let deleteSelected;
                if (view.selecting) {
                    const actions = row(phrases);
                    button(actions, 'Select all filtered', () => { category.phrases.filter(matches).forEach(phrase => view.selected.add(phrase.id)); render(); });
                    button(actions, 'Clear selection', () => { view.selected.clear(); render(); });
                    deleteSelected = button(actions, `Delete selected (${view.selected.size})`, () => deletePhrases(category, new Set(view.selected), true));
                    deleteSelected.disabled = view.selected.size === 0;
                }
                const phraseRows = el('div', undefined, phrases); phraseRows.className = 'phrase-list';
                const empty = el('p', 'No matching phrases.', phrases); empty.className = 'muted';
                category.phrases.forEach(phrase => {
                    const key = fieldKey(category.id, 'phrase', phrase.id);
                    const entry = el('div', undefined, phraseRows); entry.className = 'phrase-entry';
                    entries.push({ phrase, entry });
                    if (view.selecting) {
                        const check = input(entry, `Select phrase: ${phrase.text}`, '', 'checkbox');
                        check.checked = view.selected.has(phrase.id);
                        check.addEventListener('change', () => {
                            if (busy) { check.checked = view.selected.has(phrase.id); return; }
                            if (check.checked) view.selected.add(phrase.id); else view.selected.delete(phrase.id);
                            deleteSelected.textContent = `Delete selected (${view.selected.size})`;
                            deleteSelected.disabled = view.selected.size === 0;
                        });
                    }
                    const editor = disclosure(entry, '', key, 'phrase-edit');
                    el('span', phrase.text, editor.children[0]).className = 'phrase-copy';
                    editor.children[0].setAttribute('aria-label', `Edit phrase: ${phrase.text}`);
                    editor.children[0].setAttribute('title', phrase.text);
                    const line = row(editor); const text = pendingInput(line, ignored ? 'Email address' : 'Phrase text', phrase.text, 'text', key);
                    autoCommit(line, text, key, value => ({ type: 'edit-phrase', categoryId: category.id, phraseId: phrase.id, text: value }));
                    const remove = button(entry, ignored ? 'Delete email' : 'Delete phrase', () => deletePhrases(category, new Set([phrase.id]), false));
                    remove.textContent = '×'; remove.setAttribute('aria-label', ignored ? 'Delete email' : 'Delete phrase');
                    remove.setAttribute('title', `Delete: ${phrase.text}`);
                });
                if (!ignored) {
                    view.container = phraseRows;
                    const cancelAdd = () => {
                        view.adding = false;
                        pendingFields.delete(addKey); mountedFields.delete(addKey);
                        view.addInput?.remove(); view.addInput = null;
                    };
                    view.cancelAdd = cancelAdd;
                    const showAdd = (focus = true) => {
                        if (!view.adding) { pendingFields.delete(addKey); view.adding = true; }
                        if (!view.addInput || !phraseRows.contains?.(view.addInput)) {
                            const addInput = input(phraseRows, 'New phrase', pendingFields.get(addKey) || '');
                            view.addInput = addInput;
                            addInput.className = 'phrase-inline-input'; addInput.placeholder = 'New phrase...';
                            mountedFields.set(addKey, { node: addInput, value: '', lockWhileBusy: false });
                            addInput.addEventListener('input', () => { pendingFields.set(addKey, addInput.value); });
                            addInput.addEventListener('keydown', event => {
                                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelAdd(); search.focus?.(); }
                                if (event.key !== 'Enter') return;
                                event.preventDefault(); event.stopPropagation();
                                if (event.isComposing || busy || !addInput.value.trim()) return;
                                return runAction(() => update({ type: 'add-phrase', categoryId: category.id, text: addInput.value }, [addKey]));
                            });
                        }
                        if (focus) {
                            phraseRows.scrollTop = phraseRows.scrollHeight;
                            view.addInput.focus?.();
                            view.addInput.setSelectionRange?.(view.addInput.value.length, view.addInput.value.length);
                        }
                    };
                    phraseRows.addEventListener('click', event => {
                        if (event.target !== phraseRows) return;
                        const rect = phraseRows.getBoundingClientRect?.();
                        // Scrollbar coordinates are outside the container's client area.
                        if (rect && Number.isFinite(event.clientX) && Number.isFinite(event.clientY) &&
                            (event.clientX >= rect.left + phraseRows.clientLeft + phraseRows.clientWidth ||
                             event.clientY >= rect.top + phraseRows.clientTop + phraseRows.clientHeight)) return;
                        showAdd();
                    });
                    if (view.adding) showAdd(false);
                }
                filter();
                if (ignored) {
                    const add = row(card); const text = pendingInput(add, 'New email', '', 'text', addKey);
                    enterAdds(text, button(add, 'Add email', () => update({ type: 'add-phrase', categoryId: category.id, text: text.value }, [addKey])));
                }
            });
            const add = row(disclosure(list, 'Add a category', 'new-category', 'tool')); const name = pendingInput(add, 'New category name', '', 'text', 'new-category-name'); const color = pendingInput(add, 'New category color', '#808080', 'color', 'new-category-color');
            enterAdds(name, button(add, 'Add category', () => update({ type: 'add-category', label: name.value, color: color.value }, ['new-category-name', 'new-category-color'])));

            const exports = disclosure(panel, 'Export', 'export', 'tool');
            button(exports, 'Download database JSON', () => {
                const json = exportTriggerDatabaseJson(database);
                const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
                const link = el('a', undefined, exports); link.href = url; link.download = 'trigger-database.json';
                link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 0);
                message('Export prepared.');
            });
            const imports = disclosure(panel, 'Import', 'import', 'tool');
            el('p', selectedImportFile ? `Selected: ${selectedImportFile.name || 'JSON file'}` : 'No file selected', imports).setAttribute('role', 'status');
            if (selectedImportFile) button(imports, 'Clear selected file', () => {
                selectedImportFile = null; incoming = null; plan = null; fileSequence++;
                render();
            });
            const file = input(imports, 'Import database JSON', '', 'file'); file.accept = '.json,application/json';
            file.hidden = true;
            const importControls = el('div', undefined, imports); importControls.className = 'import-controls';
            const chooseFile = el('button', selectedImportFile ? 'Choose another file' : 'Choose JSON file', importControls);
            chooseFile.type = 'button';
            chooseFile.addEventListener('click', () => {
                // Keep picker activation synchronous with the user's click.
                if (!busy) file.click();
            });
            importFileInput = file;
            file.disabled = busy;
            file.addEventListener('change', async () => {
                const selected = file.files?.[0] || null;
                // Some browsers report cancellation as an empty change event.
                // Only the explicit clear action removes the retained selection.
                if (!selected) return;
                if (busy) {
                    // Invalidate even events queued before the control was disabled.
                    fileSequence++; incoming = null; plan = null; selectedImportFile = null;
                    render();
                    message('File selection cleared. Select the file again after the operation finishes.');
                    return;
                }
                selectedImportFile = selected;
                const sequence = ++fileSequence; incoming = null; plan = null; render();
                try {
                    if (!selected) return;
                    const parsed = parseTriggerDatabaseImportJson(await selected.text());
                    if (sequence !== fileSequence) return;
                    incoming = parsed; render(); message('File ready. Choose how to import and preview the changes.');
                } catch (_) { if (sequence === fileSequence) message('Invalid or unsupported JSON file. Nothing was changed.', true); }
            });
            const select = el('select', undefined, importControls); select.setAttribute('aria-label', 'Import mode');
            for (const [value, label] of [['merge', 'Add to mine (MERGE)'], ['replace', 'Replace mine (REPLACE)']]) {
                const option = el('option', label, select); option.value = value;
            }
            select.value = mode;
            select.addEventListener('change', () => { if (busy) { select.value = mode; return; } mode = select.value; plan = null; render(); });
            button(importControls, 'Preview changes', previewImport);
            if (plan) {
                el('p', `${mode === 'merge' ? 'Add to mine' : 'Replace mine'}: ${plan.preview.changes.length} categories affected; ${plan.preview.skippedPhrases.length} duplicate phrases skipped.`, imports);
                if (mode === 'replace') el('p', 'Categories and phrases absent from this file will be removed. Names, colors and order will follow the file.', imports);
                plan.preview.changes.forEach(change => {
                    const detail = el('details', undefined, imports);
                    detail.className = 'import-preview';
                    el('summary', `${change.type === 'add' ? 'Add' : change.type === 'delete' ? 'Remove' : 'Update'}: ${(change.after || change.before).label}`, detail);
                    phraseList(detail, change.before, 'Before'); phraseList(detail, change.after, 'After');
                });
                el('p', `Resulting category order: ${databaseSections(plan.nextDatabase).map(category => category.label).join(' → ')}`, imports);
                if (plan.isNoOp) el('p', 'Nothing to change.', imports);
                else button(imports, 'Apply import', async () => {
                    const reviewed = plan;
                    const selected = selectedImportFile;
                    const sequence = fileSequence;
                    if (confirmAction(`${mode === 'merge' ? 'Add these phrases and categories to mine' : 'Replace my complete database'}? A ${persistence ? 'verified' : 'session'} backup will be kept.${discardWarning()}`) !== true) return;
                    if (!selected || !reviewed) throw new Error('Select a file and preview it again.');
                    const reread = parseTriggerDatabaseImportJson(await selected.text());
                    if (selected !== selectedImportFile || sequence !== fileSequence || reviewed !== plan ||
                        !triggerSettingsDataMatches(reread, incoming)) {
                        plan = null; render();
                        throw new Error('The selected file changed. Preview it again.');
                    }
                    revalidateTriggerDatabaseImportPlan(reviewed, database, incoming);
                    if (persistence) database = snapshotTriggerDatabase(await persistence.save(reviewed.nextDatabase, database));
                    else { saveBackup('Before import'); database = snapshotTriggerDatabase(reviewed.nextDatabase); }
                    pendingFields.clear(); mountedFields.clear(); queuedFieldCommits.clear(); fieldErrors.clear();
                    phraseViews.forEach(view => { view.query = ''; view.adding = false; });
                    undoDeletion = null; phraseViews.forEach(view => view.selected.clear());
                    incoming = null; plan = null; selectedImportFile = null; fileSequence++;
                    const listed = await refreshBackups(); render(); savedMessage(persistence ? (listed ? 'Import saved and verified.' : 'Import saved and verified; backup list could not refresh.') : 'Import applied for this session.');
                });
            }
            const backupSection = disclosure(panel, 'Backups', 'backups', 'tool');
            el('p', persistence ? 'Verified backups are retained in local storage.' : 'These backups last only for this session. Download an export to keep a file.', backupSection);
            button(backupSection, persistence ? 'Create verified backup' : 'Create session backup', async () => {
                if (persistence) backups = await persistence.backup(database);
                else saveBackup('Manual backup');
                render(); message(persistence ? 'Backup created and verified.' : 'Session backup created.');
            });
            // Sort a copy; equal timestamps retain archive order.
            [...backups].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).forEach((backup, index) => {
                const line = row(backupSection); el('span', `${index + 1}. ${backup.label || new Date(backup.createdAt).toLocaleString()} · ${backup.database.categories.length} categories`, line);
                line.className = 'row backup-entry';
                button(line, 'Restore backup', async () => {
                    if (confirmAction(`Restore this backup? A backup of the current database will be kept.${discardWarning()}`) !== true) return;
                    const restored = persistence ? snapshotTriggerDatabase(await persistence.restore(backup.id, database)) : snapshotTriggerDatabase(backup.database);
                    if (!persistence) saveBackup('Before restore');
                    pendingFields.clear(); mountedFields.clear(); queuedFieldCommits.clear(); fieldErrors.clear();
                    phraseViews.forEach(view => { view.query = ''; });
                    database = restored; plan = null;
                    undoDeletion = null; phraseViews.forEach(view => view.selected.clear());
                    const listed = await refreshBackups(); render(); savedMessage(persistence ? (listed ? 'Backup restored and verified.' : 'Backup restored and verified; backup list could not refresh.') : 'Session backup restored.');
                });
            });
            if (activeIndex >= 0) {
                const candidates = focusable().filter(node => focusLabel(node) === activeLabel);
                const target = candidates[Math.min(activeIndex, candidates.length - 1)];
                target?.focus({ preventScroll: true });
            }
        }
        render();
        return { host, getDatabase: () => snapshotTriggerDatabase(database) };
    }

    function getAlertFlagForBehavior(behavior) {
        if (behavior === 'deletion') return 'dataDeletion';
        if (behavior === 'cancel') return 'cancelIntent';
        if (behavior === 'refund') return 'refundIntent';
        return null;
    }

    function hexToRgb(hex) {
        return {
            r: Number.parseInt(hex.slice(1, 3), 16),
            g: Number.parseInt(hex.slice(3, 5), 16),
            b: Number.parseInt(hex.slice(5, 7), 16)
        };
    }

    // Opacity is a number in [0, 1], applied ONLY to text highlight backgrounds.
    // Older databases without it retain their previous visual strength.
    function isValidCategoryOpacity(value) {
        return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
    }

    function getCategoryAlpha(category) {
        if (isValidCategoryOpacity(category.opacity)) return category.opacity;
        return (
            category.behavior === 'cancel' ||
            category.behavior === 'refund'
        )
            ? 0.28
            : 0.25;
    }

    function getCategoryLineAlpha(category) {
        return 1;
    }

    function getCategoryInlineStyle(category) {
        const { r, g, b } = hexToRgb(category.color);
        const alpha = getCategoryAlpha(category);

        return `background: rgba(${r}, ${g}, ${b}, ${alpha}); border: 2px solid ${category.color}; border-radius: 4px;`;
    }

    function buildTriggerConfigurationFromCategories(effectiveTriggerCategories) {
        effectiveTriggerCategories = effectiveTriggerCategories.map(category => ({
            ...category, opacity: getCategoryAlpha(category), highlightsVisible: category.highlightsVisible !== false
        }));
        const effectiveCategoryById = new Map(
            effectiveTriggerCategories.map(category => [
                category.id,
                category
            ])
        );

        const categoryHighlightNames = new Map(
            effectiveTriggerCategories.map((category, index) => [
                category.id,
                `zd-hl-category-${index}`
            ])
        );

        const allPatterns = [];

        effectiveTriggerCategories.forEach(category => {
            makeRegexList(
                category.phrases.map(phrase => phrase.text)
            ).forEach(regex => {
                allPatterns.push({
                    regex,
                    categoryId: category.id,
                    behavior: category.behavior
                });
            });
        });
        return { effectiveTriggerCategories, effectiveCategoryById, categoryHighlightNames, allPatterns };
    }

    // Stage 6: build only. Does not activate the database, touch CSS, or rescan.
    function buildTriggerConfigurationFromDatabase(database) {
        return buildTriggerConfigurationFromCategories(
            snapshotTriggerDatabase(database).categories
        );
    }

    function rebuildEffectiveTriggerConfiguration(settings) {
        const configuration = buildTriggerConfigurationFromCategories(
            buildEffectiveTriggerCategories(settings)
        );
        effectiveTriggerCategories = configuration.effectiveTriggerCategories;
        effectiveCategoryById = configuration.effectiveCategoryById;
        categoryHighlightNames = configuration.categoryHighlightNames;
        allPatterns = configuration.allPatterns;
    }

    function rebuildHighlightStyles() {
        let style = document.getElementById(
            'zd-safe-highlight-style'
        );

        if (!style) {
            style = document.createElement('style');
            style.id = 'zd-safe-highlight-style';
            document.head.appendChild(style);
        }

        const categoryRules = effectiveTriggerCategories
            .filter(category => category.highlightsVisible !== false)
            .map(category => {
                const { r, g, b } = hexToRgb(category.color);
                const alpha = getCategoryAlpha(category);
                const lineAlpha = getCategoryLineAlpha(category);
                const highlightName =
                    categoryHighlightNames.get(category.id);

                return `
        ::highlight(${highlightName}) {
            background: rgba(${r}, ${g}, ${b}, ${alpha});
            text-decoration: underline 2px rgba(${r}, ${g}, ${b}, ${lineAlpha});
        }`;
            })
            .join('\n');

        style.textContent = `
        ${categoryRules}

        ::highlight(${HIGHLIGHT_NAMES.sensitiveData}) {
            background: rgba(155, 89, 255, 0.22);
            text-decoration: underline 2px rgba(155, 89, 255, 0.95);
        }

        ::highlight(${HIGHLIGHT_NAMES.otherEmail}) {
            background: rgba(0, 184, 212, 0.18);
            text-decoration: underline 2px rgba(0, 184, 212, 0.95);
        }

        ::highlight(${HIGHLIGHT_NAMES.russianEmail}) {
            background: rgba(255, 152, 0, 0.18);
            text-decoration: underline 2px rgba(255, 152, 0, 0.95);
        }
    `;
    }

    function ensureHighlightStyles() {
        if (document.getElementById('zd-safe-highlight-style')) return;

        rebuildHighlightStyles();
    }

    // Legacy backup recovery helper state; legacy settings have no UI.
    let triggerSettingsBackupIdSequence = 0;

    function normalizePhraseDuplicateValue(value) {
        return (value || '').trim().toLocaleLowerCase();
    }

    function createQcPackageExport(draft) {
        const description = (draft.description || '').trim();
        const qcPackage = {
            format: QC_PACKAGE_EXPORT_FORMAT,
            schemaVersion: QC_PACKAGE_EXPORT_SCHEMA_VERSION,
            packageId: draft.packageId,
            packageVersion: draft.packageVersion,
            createdAt: new Date().toISOString(),
            categories: draft.categories.map(category => ({
                id: category.id,
                label: category.label,
                color: category.color,
                behavior: category.behavior,
                phrases: category.phrases.map(phrase => ({
                    id: phrase.id,
                    text: phrase.text
                }))
            }))
        };

        if (description) qcPackage.description = description;

        return qcPackage;
    }

    function validateQcPackageExport(qcPackage) {
        if (!isPlainObject(qcPackage)) return false;

        const allowedPackageKeys = new Set([
            'format',
            'schemaVersion',
            'packageId',
            'packageVersion',
            'createdAt',
            'description',
            'categories'
        ]);

        if (
            !Object.keys(qcPackage).every(key =>
                allowedPackageKeys.has(key)
            ) ||
            qcPackage.format !== QC_PACKAGE_EXPORT_FORMAT ||
            qcPackage.schemaVersion !==
                QC_PACKAGE_EXPORT_SCHEMA_VERSION ||
            typeof qcPackage.packageId !== 'string' ||
            !qcPackage.packageId.trim() ||
            typeof qcPackage.packageVersion !== 'string' ||
            !qcPackage.packageVersion.trim() ||
            typeof qcPackage.createdAt !== 'string' ||
            Number.isNaN(Date.parse(qcPackage.createdAt)) ||
            new Date(qcPackage.createdAt).toISOString() !==
                qcPackage.createdAt ||
            (
                qcPackage.description !== undefined &&
                typeof qcPackage.description !== 'string'
            ) ||
            !Array.isArray(qcPackage.categories)
        ) {
            return false;
        }

        const categoryKeys = new Set([
            'id',
            'label',
            'color',
            'behavior',
            'phrases'
        ]);
        const phraseKeys = new Set(['id', 'text']);

        if (
            !qcPackage.categories.every(category => (
                isPlainObject(category) &&
                Object.keys(category).every(key =>
                    categoryKeys.has(key)
                ) &&
                Array.isArray(category.phrases) &&
                category.phrases.every(phrase => (
                    isPlainObject(phrase) &&
                    Object.keys(phrase).every(key =>
                        phraseKeys.has(key)
                    )
                ))
            ))
        ) {
            return false;
        }

        return validateQcBase({
            schemaVersion: TRIGGER_SETTINGS_SCHEMA_VERSION,
            packageId: qcPackage.packageId,
            packageVersion: qcPackage.packageVersion,
            description: qcPackage.description,
            categories: qcPackage.categories
        });
    }

    function validateImportedQcPackage(value) {
        if (!isPlainObject(value)) {
            return { valid: false, error: 'The JSON root must be an object.' };
        }

        if (value.format !== QC_PACKAGE_EXPORT_FORMAT) {
            return {
                valid: false,
                error: `Unsupported package format. Expected "${QC_PACKAGE_EXPORT_FORMAT}".`
            };
        }

        if (value.schemaVersion !== QC_PACKAGE_EXPORT_SCHEMA_VERSION) {
            return {
                valid: false,
                error: `Unsupported schema version. Expected version ${QC_PACKAGE_EXPORT_SCHEMA_VERSION}.`
            };
        }

        if (
            typeof value.packageId !== 'string' ||
            !value.packageId.trim()
        ) {
            return { valid: false, error: 'A package ID is required.' };
        }

        if (
            typeof value.packageVersion !== 'string' ||
            !value.packageVersion.trim()
        ) {
            return { valid: false, error: 'A package version is required.' };
        }

        if (
            typeof value.createdAt !== 'string' ||
            Number.isNaN(Date.parse(value.createdAt)) ||
            new Date(value.createdAt).toISOString() !== value.createdAt
        ) {
            return {
                valid: false,
                error: 'The package creation timestamp must be a valid ISO timestamp.'
            };
        }

        if (
            value.description !== undefined &&
            typeof value.description !== 'string'
        ) {
            return {
                valid: false,
                error: 'The optional package description must be text.'
            };
        }

        if (!Array.isArray(value.categories)) {
            return {
                valid: false,
                error: 'The package categories field must be an array.'
            };
        }

        const categoryIds = new Set();
        const phraseIds = new Set();
        const allowedBehaviors = new Set([
            'trigger',
            'deletion',
            'cancel',
            'refund'
        ]);
        const protectedByBehavior = new Map(
            Object.values(PROTECTED_TRIGGER_CATEGORIES)
                .map(category => [category.behavior, category.id])
                .filter(([behavior]) => behavior !== 'trigger')
        );

        for (const category of value.categories) {
            if (!isPlainObject(category)) {
                return {
                    valid: false,
                    error: 'Every category must be an object.'
                };
            }

            if (typeof category.id !== 'string' || !category.id) {
                return {
                    valid: false,
                    error: 'Every category requires a non-empty ID.'
                };
            }

            if (categoryIds.has(category.id)) {
                return {
                    valid: false,
                    error: `Duplicate category ID: ${category.id}.`
                };
            }

            categoryIds.add(category.id);

            if (
                typeof category.label !== 'string' ||
                !category.label.trim()
            ) {
                return {
                    valid: false,
                    error: `Category ${category.id} requires a name.`
                };
            }

            if (!isValidTriggerColor(category.color)) {
                return {
                    valid: false,
                    error: `Category ${category.id} has an invalid color.`
                };
            }

            if (!allowedBehaviors.has(category.behavior)) {
                return {
                    valid: false,
                    error: `Category ${category.id} has an unsupported behavior.`
                };
            }

            const protectedId = protectedByBehavior.get(
                category.behavior
            );

            if (
                protectedId !== undefined &&
                category.id !== protectedId
            ) {
                return {
                    valid: false,
                    error: `Behavior ${category.behavior} must use protected category ID ${protectedId}.`
                };
            }

            if (!Array.isArray(category.phrases)) {
                return {
                    valid: false,
                    error: `Category ${category.id} must contain a phrases array.`
                };
            }

            for (const phrase of category.phrases) {
                if (
                    !isPlainObject(phrase) ||
                    typeof phrase.id !== 'string' ||
                    !phrase.id ||
                    typeof phrase.text !== 'string' ||
                    !phrase.text.trim()
                ) {
                    return {
                        valid: false,
                        error: `Category ${category.id} contains an invalid phrase record.`
                    };
                }

                if (phraseIds.has(phrase.id)) {
                    return {
                        valid: false,
                        error: `Phrase ID ${phrase.id} is not globally unique.`
                    };
                }

                phraseIds.add(phrase.id);
            }
        }

        for (const protectedCategory of Object.values(
            PROTECTED_TRIGGER_CATEGORIES
        )) {
            const category = value.categories.find(
                item => item.id === protectedCategory.id
            );

            if (!category) {
                return {
                    valid: false,
                    error: `Missing protected category ${protectedCategory.id}.`
                };
            }

            if (category.behavior !== protectedCategory.behavior) {
                return {
                    valid: false,
                    error: `Protected category ${protectedCategory.id} must keep behavior ${protectedCategory.behavior}.`
                };
            }
        }

        if (!validateQcPackageExport(value)) {
            return {
                valid: false,
                error: 'The package contains unsupported fields or invalid QC data.'
            };
        }

        return {
            valid: true,
            qcPackage: cloneTriggerSettings(value)
        };
    }

    function createQcBaseFromImportedPackage(qcPackage) {
        const qcBase = {
            schemaVersion: TRIGGER_SETTINGS_SCHEMA_VERSION,
            packageId: qcPackage.packageId,
            packageVersion: qcPackage.packageVersion,
            categories: cloneTriggerSettings(qcPackage.categories)
        };

        if (qcPackage.description !== undefined) {
            qcBase.description = qcPackage.description;
        }

        return qcBase;
    }

    function openTriggerSettingsMenu() {
        if (IS_ZENDESK) return openSingleDatabaseSettings();
    }

    function ensureAlertPanel() {
        let panel = document.getElementById('zd-alert-panel');

        if (panel) return panel;

        panel = document.createElement('div');
        panel.id = 'zd-alert-panel';

        panel.style.position = 'fixed';
        panel.style.right = '168px';
        panel.style.bottom = '56px';
        panel.style.zIndex = '999999';
        panel.style.padding = '10px 12px';
        panel.style.borderRadius = '10px';
        panel.style.background = 'rgba(32, 33, 36, 0.92)';
        panel.style.color = '#ffffff';
        panel.style.fontSize = '12px';
        panel.style.fontFamily = 'Arial, sans-serif';
        panel.style.boxShadow = '0 4px 14px rgba(0,0,0,0.25)';
        panel.style.pointerEvents = 'auto';
        panel.style.userSelect = 'none';

        panel.innerHTML = `
            <div
                data-zd-alert-drag-handle="true"
                style="font-weight: 700; margin-bottom: 6px; cursor: move;"
            >
                ZD Alerts
            </div>
            <button
                type="button"
                data-zd-trigger-settings-button="true"
                title="View trigger settings"
                aria-label="View trigger settings"
                style="position: absolute; top: 7px; right: 7px; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 6px; background: rgba(255,255,255,0.08); color: #ffffff; cursor: pointer; font-size: 15px; line-height: 24px;"
            >&#9881;</button>
            <div data-zd-alert-row="g1">G1: —</div>
            <div data-zd-alert-row="g2">G2: —</div>
            <div data-zd-alert-row="policies">Policies: —</div>
            <div data-zd-alert-row="russianEmail">Russian email: —</div>
            <div data-zd-alert-row="dataDeletion">Deletion: —</div>
            <div data-zd-alert-row="sensitiveData">Sensitive data: —</div>
            <div data-zd-alert-row="requestIntent">Request: None</div>
        `;

        document.body.appendChild(panel);

        panel
            .querySelector(
                '[data-zd-trigger-settings-button="true"]'
            )
            ?.addEventListener(
                'click',
                openTriggerSettingsMenu
            );

        makeAlertPanelDraggable(panel);

        return panel;
    }

    function makeAlertPanelDraggable(panel) {
        const handle = panel.querySelector('[data-zd-alert-drag-handle="true"]');

        if (!handle) return;

        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        handle.addEventListener('mousedown', event => {
            isDragging = true;

            const rect = panel.getBoundingClientRect();

            startX = event.clientX;
            startY = event.clientY;
            startLeft = rect.left;
            startTop = rect.top;

            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.top}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';

            event.preventDefault();
        });

        document.addEventListener('mousemove', event => {
            if (!isDragging) return;

            const nextLeft = startLeft + event.clientX - startX;
            const nextTop = startTop + event.clientY - startY;

            panel.style.left = `${nextLeft}px`;
            panel.style.top = `${nextTop}px`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    function getAlertCategoryColor(categoryId) {
        return effectiveCategoryById.get(categoryId)?.color || '#9aa0a6';
    }

    function recordAlertCategory(flags, categoryId) {
        if (FORMA_TEAM_CATEGORIES.some(category => category.id === categoryId)) flags[categoryId] = true;
    }

    function updateAlertPanel(flags) {
        const panel = ensureAlertPanel();
        const rows = {
            g1: { label: 'G1', activeColor: getAlertCategoryColor('g1') },
            g2: { label: 'G2', activeColor: getAlertCategoryColor('g2') },
            policies: { label: 'Policies', activeColor: getAlertCategoryColor('policies') },
            russianEmail: { label: 'Russian email', activeColor: '#ff9800' },
            dataDeletion: {
                label: 'Deletion',
                activeColor: getAlertCategoryColor('data-deletion')
            },
            sensitiveData: {
                label: 'Sensitive data',
                activeColor: '#b388ff'
            }
        };

        Object.entries(rows).forEach(([key, config]) => {
            const row = panel.querySelector(`[data-zd-alert-row="${key}"]`);

            if (!row) return;

            const isActive = !!flags[key];

            row.textContent = `${config.label}: ${isActive ? '⚠️' : '—'}`;

            if (isActive) {
                row.style.color = config.activeColor;
                row.style.fontWeight = '700';
                row.style.opacity = '1';
            } else {
                row.style.color = '#9aa0a6';
                row.style.fontWeight = '400';
                row.style.opacity = '0.6';
            }
        });

        const requestRow =
            panel.querySelector(
                '[data-zd-alert-row="requestIntent"]'
            );

        if (requestRow) {
            let requestIntent = 'None';
            let requestColor = '#9aa0a6';

            if (flags.refundIntent) {
                requestIntent = 'Refund';
                requestColor = getAlertCategoryColor('refund-intent');
            } else if (flags.cancelIntent) {
                requestIntent = 'Cancel';
                requestColor = getAlertCategoryColor('cancel-intent');
            }

            const requestText = `Request: ${requestIntent}`;
            if (requestRow.textContent !== requestText) requestRow.textContent = requestText;

            requestRow.style.color =
                requestColor;

            requestRow.style.fontWeight =
                requestIntent === 'None'
                    ? '400'
                    : '700';

            requestRow.style.opacity =
                requestIntent === 'None'
                    ? '0.6'
                    : '1';
        }
    }

    function scanSubjectAndSidebarFlags(flags) {
        document.querySelectorAll('input[data-test-id="omni-header-subject"]').forEach(el => {
            if (!isDisplayedContent(el)) return;
            const value = el.value || '';

            if (collectRussianEmailMatches(value).length) flags.russianEmail = true;

            if (textContainsSensitiveData(value)) {
                flags.sensitiveData = true;
            }

            allPatterns.forEach(item => {
                const flagKey = getAlertFlagForBehavior(
                    item.behavior
                );

                item.regex.lastIndex = 0;

                if (item.regex.test(value)) {
                    if (flagKey && flags.hasOwnProperty(flagKey)) flags[flagKey] = true;
                    recordAlertCategory(flags, item.categoryId);
                }
            });
        });
        if (getRussianEmailFields().some(emailFieldContainsRussianEmail)) flags.russianEmail = true;
    }

    function isDisplayedContent(el) {
        return !el.getClientRects || el.getClientRects().length > 0;
    }

    function isCustomerComment(commentEl) {
        const itemEl = commentEl.closest('[data-test-id="omni-log-item-message"]');

        if (!itemEl) return false;

        return itemEl.getAttribute('type') === 'end-user';
    }

    function isEditableElement(element) {
        if (!element) return false;

        return !!element.closest?.(
            '[contenteditable="true"], textarea, input, [role="textbox"], .zd-editor, .zendesk-editor'
        );
    }

    function getReadableTextNodes(rootElement) {
        const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];

        let node;
        while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent) continue;

            if (
                parent.tagName === 'SCRIPT' ||
                parent.tagName === 'STYLE' ||
                parent.tagName === 'NOSCRIPT' ||
                parent.closest('mark') ||
                isEditableElement(parent)
            ) {
                continue;
            }

            if (!node.nodeValue || !node.nodeValue.trim()) continue;

            textNodes.push(node);
        }

        return textNodes;
    }

    // Match the whole digit run before validating length; never highlight a suffix of an overlong number.
    const PAN_CANDIDATE_REGEX = /(?<![A-Z0-9])\d(?:[\s.-]*\d){12,}(?![A-Z0-9])/gi;
    const CVV_REGEX =
        /\b(?:CVV2?|CVC2?|CID|card\s+security\s+code|security\s+code)\b\s*(?:is\s*)?(?:[:=#-]\s*)?(\d{3,4})\b/gi;

    function getOnlyDigits(text) {
        return (text || '').replace(/\D/g, '');
    }


    function isValidLuhnNumber(text) {
        const digits = getOnlyDigits(text);

        if (digits.length < 13 || digits.length > 19) {
            return false;
        }

        if (/^(\d)\1+$/.test(digits)) {
            return false;
        }

        let sum = 0;
        let doubleDigit = false;

        for (let i = digits.length - 1; i >= 0; i--) {
            let digit = Number(digits[i]);

            if (doubleDigit) {
                digit *= 2;

                if (digit > 9) {
                    digit -= 9;
                }
            }

            sum += digit;
            doubleDigit = !doubleDigit;
        }

        return sum % 10 === 0;
    }


    function addMatch(
        matches,
        start,
        end,
        type
    ) {
        if (
            !Number.isInteger(start) ||
            !Number.isInteger(end)
        ) {
            return;
        }

        if (
            start < 0 ||
            end <= start
        ) {
            return;
        }

        const key =
            `${start}:${end}`;

        if (
            matches.some(
                item =>
                    `${item.start}:${item.end}` === key
            )
        ) {
            return;
        }

        matches.push({
            start,
            end,
            type
        });
    }


    function addRegexMatches(
        matches,
        text,
        regex,
        type,
        captureGroup = 0,
        validator = null
    ) {
        const re = new RegExp(
            regex.source,
            regex.flags.includes('g')
                ? regex.flags
                : `${regex.flags}g`
        );

        let match;

        while (
            (match = re.exec(text)) !== null
        ) {
            const value =
                match[captureGroup];

            if (!value) {
                if (
                    re.lastIndex === match.index
                ) {
                    re.lastIndex++;
                }

                continue;
            }

            if (
                !validator ||
                validator(value, match)
            ) {
                const relativeIndex =
                    captureGroup === 0
                        ? 0
                        : match[0].indexOf(value);

                if (relativeIndex >= 0) {
                    addMatch(
                        matches,
                        match.index + relativeIndex,
                        match.index +
                            relativeIndex +
                            value.length,
                        type
                    );
                }
            }

            if (
                re.lastIndex === match.index
            ) {
                re.lastIndex++;
            }
        }
    }


    function collectSensitiveMatches(text) {
        const matches = [];
        const source = text || '';
        addRegexMatches(matches, source, PAN_CANDIDATE_REGEX, 'PAN', 0, isValidLuhnNumber);
        addRegexMatches(matches, source, CVV_REGEX, 'CVV/CVC', 1);
        return matches.sort((a, b) => a.start - b.start || a.end - b.end);
    }

    function textContainsSensitiveData(text) {
        return (
            collectSensitiveMatches(
                text
            ).length > 0
        );
    }


    function addSensitiveRangesForTextNode(
        textNode,
        bucket,
        foundFlags
    ) {
        const text =
            textNode.nodeValue || '';

        const matches =
            collectSensitiveMatches(
                text
            );

        matches.forEach(match => {
            const range = new Range();

            range.setStart(
                textNode,
                match.start
            );

            range.setEnd(
                textNode,
                match.end
            );

            bucket.add(range);
        });

        if (matches.length > 0) {
            foundFlags.sensitiveData = true;
        }
    }


    const ANY_EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

    const ticketEmailCache = new Map();

    function normalizeEmail(email) {
        return (email || '').trim().toLowerCase();
    }

    function getSidebarEmail(ticketId = getCurrentTicketId()) {
        if (!ticketId) return '';
        const panel = document.getElementById(`customer-context-user-panel-${ticketId}`);
        if (!panel || !isDisplayedContent(panel)) return '';
        const field = panel.querySelector?.('[data-test-id="email-value-test-id"]');
        if (!field || isEditableElement(field) || !isDisplayedContent(field)) return '';
        const value = field.getAttribute('title') || field.textContent || '';
        return normalizeEmail(value.match(new RegExp(ANY_EMAIL_REGEX.source, 'gi'))?.[0]);
    }

    function getCurrentCustomerEmail() {
        const ticketId = getCurrentTicketId();
        if (!ticketId) return '';
        const fresh = getSidebarEmail(ticketId);
        if (fresh) ticketEmailCache.set(ticketId, fresh);
        return fresh || ticketEmailCache.get(ticketId) || '';
    }

    function collectOtherEmailMatches(text, sidebarEmail) {
        if (!sidebarEmail) return [];
        return [...(text || '').matchAll(new RegExp(ANY_EMAIL_REGEX.source, 'gi'))]
            .filter(match => normalizeEmail(match[0]) !== sidebarEmail &&
                !activeIgnoredEmails.has(normalizeEmail(match[0])));
    }

    function collectRussianEmailMatches(text) {
        return [...(text || '').matchAll(new RegExp(ANY_EMAIL_REGEX.source, 'gi'))]
            .filter(match => RUSSIAN_EMAIL_DOMAINS.includes(match[0].split('@')[1].toLowerCase()));
    }

    const russianEmailFieldStyles = new Map();

    function resetRussianEmailFields() {
        russianEmailFieldStyles.forEach((previous, el) => Object.assign(el.style, previous));
        russianEmailFieldStyles.clear();
    }

    function getRussianEmailFields() {
        const ticketId = getCurrentTicketId();
        const panel = ticketId && document.getElementById(`customer-context-user-panel-${ticketId}`);
        if (!panel?.querySelectorAll || !isDisplayedContent(panel)) return [];
        return [...panel.querySelectorAll('[data-test-id="email-value-test-id"], [data-garden-id="email.value"], [title*="@"]')]
            .filter(el => !isEditableElement(el) && isDisplayedContent(el));
    }

    function emailFieldContainsRussianEmail(el) {
        return collectRussianEmailMatches((el.textContent || '') + ' ' + (el.getAttribute('title') || '')).length > 0;
    }

    function highlightRussianEmailFields() {
        resetRussianEmailFields();
        getRussianEmailFields().forEach(el => {
            if (!emailFieldContainsRussianEmail(el)) return;
            const previous = {};
            ['background', 'border', 'borderRadius', 'padding', 'boxShadow', 'display'].forEach(key => { previous[key] = el.style[key]; });
            russianEmailFieldStyles.set(el, previous);
            Object.assign(el.style, cssTextToObject(COLORS.russianEmail), {
                padding: '2px 4px', boxShadow: '0 0 0 1px rgba(0,0,0,0.05)', display: 'inline-block'
            });
        });
    }

    function buildHighlightsForComments() {
        if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') {
            return;
        }

        ensureHighlightStyles();

        Object.values(HIGHLIGHT_NAMES).forEach(name => {
            CSS.highlights.delete(name);
        });

        categoryHighlightNames.forEach(name => {
            CSS.highlights.delete(name);
        });

        const sidebarEmail = getCurrentCustomerEmail();
        const systemBuckets = {
            otherEmail: new Highlight(),
            russianEmail: new Highlight(),
            sensitiveData: new Highlight()
        };

        const categoryBuckets = new Map(
            effectiveTriggerCategories.map(category => [
                category.id,
                new Highlight()
            ])
        );

        const foundFlags = {
            dataDeletion: false,
            sensitiveData: false,
            cancelIntent: false,
            refundIntent: false
        };

        scanSubjectAndSidebarFlags(foundFlags);

        document.querySelectorAll('.zd-comment').forEach(commentEl => {
            if (!commentEl) return;
            if (!isCustomerComment(commentEl) || !isDisplayedContent(commentEl)) return;

            if (
                commentEl.matches?.('[contenteditable="true"], textarea, input, [role="textbox"], .zd-editor, .zendesk-editor') ||
                commentEl.querySelector?.('[contenteditable="true"], textarea, input, [role="textbox"], .zd-editor, .zendesk-editor')
            ) {
                return;
            }

            const textNodes =
                getReadableTextNodes(commentEl);

            textNodes.forEach(textNode => {
                const text = textNode.nodeValue;
                if (!text) return;

                addSensitiveRangesForTextNode(
                    textNode,
                    systemBuckets.sensitiveData,
                    foundFlags
                );

                collectOtherEmailMatches(text, sidebarEmail).forEach(match => {
                    const range = new Range();
                    range.setStart(textNode, match.index);
                    range.setEnd(textNode, match.index + match[0].length);
                    systemBuckets.otherEmail.add(range);
                });

                collectRussianEmailMatches(text).forEach(match => {
                    const range = new Range();
                    range.setStart(textNode, match.index);
                    range.setEnd(textNode, match.index + match[0].length);
                    systemBuckets.russianEmail.add(range);
                    foundFlags.russianEmail = true;
                });

                allPatterns.forEach(item => {
                    const flags = item.regex.flags.includes('g')
                        ? item.regex.flags
                        : item.regex.flags + 'g';

                    const re = new RegExp(item.regex.source, flags);

                    let match;
                    while ((match = re.exec(text)) !== null) {
                        const matchedText = match[0];
                        if (!matchedText) break;

                        const range = new Range();
                        range.setStart(textNode, match.index);
                        range.setEnd(textNode, match.index + matchedText.length);

                        categoryBuckets
                            .get(item.categoryId)
                            ?.add(range);

                        const flagKey = getAlertFlagForBehavior(
                            item.behavior
                        );

                        if (flagKey && foundFlags.hasOwnProperty(flagKey)) {
                            foundFlags[flagKey] = true;
                        }
                        recordAlertCategory(foundFlags, item.categoryId);

                        if (re.lastIndex === match.index) {
                            re.lastIndex++;
                        }
                    }
                });
            });
        });

        updateAlertPanel(foundFlags);

        const registerCategoryHighlights = behaviors => {
            effectiveTriggerCategories.forEach(category => {
                if (!behaviors.has(category.behavior) || category.highlightsVisible === false) return;

                CSS.highlights.set(
                    categoryHighlightNames.get(category.id),
                    categoryBuckets.get(category.id)
                );
            });
        };

        registerCategoryHighlights(
            new Set(['trigger', 'deletion'])
        );

        Object.entries(systemBuckets).forEach(([styleKey, highlight]) => {
            CSS.highlights.set(
                HIGHLIGHT_NAMES[styleKey],
                highlight
            );
        });

        registerCategoryHighlights(
            new Set(['cancel', 'refund'])
        );
    }

    function getMatchedStyle(text) {
        for (const item of allPatterns) {
            item.regex.lastIndex = 0;

            if (item.regex.test(text)) {
                const category = effectiveCategoryById.get(
                    item.categoryId
                );

                if (category && category.highlightsVisible !== false) {
                    return getCategoryInlineStyle(category);
                }
            }
        }

        return null;
    }

    function cssTextToObject(cssText) {
        const styles = {};

        cssText.split(';').forEach(rule => {
            const [prop, value] = rule.split(':').map(s => s && s.trim());

            if (prop && value) {
                const jsProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                styles[jsProp] = value;
            }
        });

        return styles;
    }

    function highlightSubjectInput(el) {
        if (!el) return;

        const value = el.value || '';

        // Legacy subject comparison uses the first email; trigger and Russian
        // styles retain precedence over the other-email fallback.
        const firstEmail = value.match(new RegExp(ANY_EMAIL_REGEX.source, 'gi'))?.[0] || '';
        const isOtherEmail = collectOtherEmailMatches(firstEmail, getCurrentCustomerEmail()).length > 0;
        const isRussianEmail = collectRussianEmailMatches(value).length > 0;

        const triggerStyle = getMatchedStyle(value);

        const hasSensitiveData =
            textContainsSensitiveData(value);

        const matchedStyle =
            hasSensitiveData
                ? COLORS.sensitiveData
                : isRussianEmail
                    ? COLORS.russianEmail
                    : triggerStyle || (isOtherEmail ? COLORS.otherEmail : null);

        if (!matchedStyle) {
            el.style.background = '';
            el.style.border = '';
            el.style.borderRadius = '';
            el.style.boxShadow = '';
            return;
        }

        const parsed = cssTextToObject(matchedStyle);

        if (parsed.background) {
            el.style.background = parsed.background;
        }

        if (parsed.border) {
            el.style.border = parsed.border;
        }

        if (parsed.borderRadius) {
            el.style.borderRadius = parsed.borderRadius;
        }

        el.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.05)';
    }

    function scanComments() {
        buildHighlightsForComments();
    }

    function scanSubjects() {
        document.querySelectorAll('input[data-test-id="omni-header-subject"]').forEach(el => {
            if (!isDisplayedContent(el)) return;
            highlightSubjectInput(el);

            if (!el.dataset.subjectListenerAttached) {
                el.addEventListener('input', () => { highlightSubjectInput(el); buildHighlightsForComments(); });
                el.dataset.subjectListenerAttached = 'true';
            }
        });
    }

    function clearZendeskHighlights() {
        if (window.CSS?.highlights) {
            Object.values(HIGHLIGHT_NAMES).forEach(name => CSS.highlights.delete(name));
            categoryHighlightNames.forEach(name => CSS.highlights.delete(name));
        }
        resetRussianEmailFields();
        document.querySelectorAll('input[data-test-id="omni-header-subject"]').forEach(el => {
            ['background', 'border', 'borderRadius', 'boxShadow'].forEach(key => { el.style[key] = ''; });
        });
    }

    function scanAll() {
        if (IS_SOLIDGATE) {
            scanCountries();
            return;
        }

        if (!IS_ZENDESK) {
            return;
        }

        if (!zendeskTriggerSettingsInitialized) {
            return;
        }

        if (!getCurrentTicketId()) {
            clearZendeskHighlights();
            updateAlertPanel({
                dataDeletion: false,
                sensitiveData: false
            });

            return;
        }

        scanComments();
        scanSubjects();
        highlightRussianEmailFields();
    }

    let scanTimer = null;
    let zendeskRefreshTimers = [];

    function getCurrentTicketId() {
        const match = location.href.match(/\/tickets\/(\d+)/);

        return match
            ? match[1]
            : '';
    }

    function scheduleScanAll() {
        clearTimeout(scanTimer);

        zendeskRefreshTimers.forEach(clearTimeout);
        zendeskRefreshTimers = [];
        scanTimer = setTimeout(() => {
            scanAll();
            // Retain Zendesk's delayed subject refresh while avoiding queued duplicates.
            if (IS_ZENDESK) zendeskRefreshTimers = [700, 1800, 3500].map(delay => setTimeout(scanAll, delay));
        }, 250);
    }

    const observer = new MutationObserver(mutations => {
        let shouldHighlight = false;

        for (const mutation of mutations) {
            if (
                mutation.type === 'characterData' ||
                mutation.type === 'attributes' ||
                mutation.addedNodes.length > 0 ||
                mutation.removedNodes.length > 0
            ) {
                shouldHighlight = true;
                break;
            }
        }

        if (shouldHighlight) {
            scheduleScanAll();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['title', 'data-testid', 'data-test-id', 'id', 'hidden', 'aria-hidden']
    });

    async function initializeZendeskTriggerSettings() {
        if (!IS_ZENDESK) return;
        if (!singleDatabaseInitialization) singleDatabaseInitialization = (async () => {
            try {
                let existing = await readTriggerDatabaseFromStorage();
                if (existing === null) {
                    const initial = snapshotTriggerDatabase({
                        schemaVersion: TRIGGER_DATABASE_SCHEMA_VERSION,
                        categories: createDefaultQcBase().categories
                    });
                    existing = await saveTriggerDatabaseToStorage(initial, { requireAbsent: true });
                }
                await ensureFormaTeamUpgrade(existing);
                const current = await readTriggerDatabaseFromStorage();
                if (current.ignoredEmails === undefined) {
                    await saveTriggerDatabaseToStorage(snapshotTriggerDatabase(current), {
                        beforeWrite: async () => {
                            if (!triggerSettingsDataMatches(await readTriggerDatabaseFromStorage(), current)) throw new Error('Database changed during ignored-email upgrade.');
                        }
                    });
                }
                // Prepare the editor without mounting or opening a settings window.
                singleDatabaseSettingsUi = await createPersistentTriggerDatabaseSettingsUi(undefined, refreshSingleDatabaseHighlights);
                singleDatabaseSettingsStatus = 'Use one editing Zendesk tab at a time.';
                try { refreshSingleDatabaseHighlights(singleDatabaseSettingsUi.getDatabase()); }
                catch (_) { singleDatabaseSettingsStatus += ' Warning: highlighting refresh failed. The verified database is displayed. Reload the Zendesk page (F5).'; }
            } catch (_) {
                singleDatabaseSettingsStatus = 'Settings stopped: database loading, initialization, or verification failed. Highlighting was not activated. Recovery is required. Reload the Zendesk page (F5) after recovery.';
                console.error('[Zendesk Highlighter] ' + singleDatabaseSettingsStatus);
                window.alert?.(singleDatabaseSettingsStatus);
            }
        })();
        await singleDatabaseInitialization;
    }

    if (IS_ZENDESK) {
        void initializeZendeskTriggerSettings().catch(error => {
            console.error('[Zendesk Highlighter] Settings stopped; no defaults were applied. Reload the Zendesk page (F5) after recovery.', error);
        });
    }

    setTimeout(scanAll, 500);
    setTimeout(scanAll, 1500);
    setTimeout(scanAll, 3000);
})();
