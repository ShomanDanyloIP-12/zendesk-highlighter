// ==UserScript==
// @name         Zendesk Highlighter (Safe Mode + Subject)
// @namespace    http://tampermonkey.net/
// @version      6.12
// @description  Highlight key phrases in comments and ticket subject securely without breaking HTML
// @match        https://*.zendesk.com/*
// @grant        none
// @downloadURL  https://cdn.jsdelivr.net/gh/ShomanDanyloIP-12/zendesk-highlighter@main/zendesk-highlighter.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/ShomanDanyloIP-12/zendesk-highlighter@main/zendesk-highlighter.user.js
// @homepageURL  https://github.com/ShomanDanyloIP-12/zendesk-highlighter
// @supportURL   https://github.com/ShomanDanyloIP-12/zendesk-highlighter/issues
// ==/UserScript==

(function () {
    'use strict';

    const COLORS = {
        g1: "background: rgba(245, 41, 27, 0.25); border: 2px solid #f5291b; border-radius: 4px;",
        g2: "background: rgba(250, 231, 17, 0.25); border: 2px solid #fae711; border-radius: 4px;",
        dataDeletion: "background: rgba(139, 94, 60, 0.25); border: 2px solid #8b5e3c; border-radius: 4px;",
        policies: "background: rgba(255, 105, 180, 0.22); border: 2px solid #ff69b4; border-radius: 4px;"
    };

    const G1_TRIGGERS = [
        "Competition and Consumer Commission",
        "ACCC",
        "Authority for Consumers and Markets",
        "ACM",
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
        "European Consumer Centre",
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
        "According to your PayPal"
    ];

    const G2_TRIGGERS = [
        "ask Paypal",
        "through PayPal",
        "called my bank",
        "report to Amex",
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
        "disputing",
        "escalated through PayPal",
        "contact with my bank",
        "escalate this matter through my credit card",
        "Report as scam",
        "Report as fraud",
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
        "contact Paypal",
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
        "refund from PayPal"
    ];

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
        "cancel the account",
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
        "account has been completely deactivated"
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
        "14 days to cancel"
    ];

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

    let allPatterns = [];

    function addPatterns(words, styleKey) {
        makeRegexList(words).forEach(regex => {
            allPatterns.push({ regex, styleKey });
        });
    }

    addPatterns(G1_TRIGGERS, 'g1');
    addPatterns(G2_TRIGGERS, 'g2');
    addPatterns(DATA_DELETION_TRIGGERS, 'dataDeletion');
    addPatterns(POLICIES_TRIGGERS, 'policies');

    const HIGHLIGHT_NAMES = {
        g1: 'zd-hl-g1',
        g2: 'zd-hl-g2',
        dataDeletion: 'zd-hl-data-deletion',
        policies: 'zd-hl-policies'
    };

    function ensureHighlightStyles() {
        if (document.getElementById('zd-safe-highlight-style')) return;

        const style = document.createElement('style');
        style.id = 'zd-safe-highlight-style';
        style.textContent = `
        ::highlight(${HIGHLIGHT_NAMES.g1}) {
            background: rgba(245, 41, 27, 0.25);
            text-decoration: underline 2px rgba(245, 41, 27, 0.9);
        }

        ::highlight(${HIGHLIGHT_NAMES.g2}) {
            background: rgba(250, 231, 17, 0.25);
            text-decoration: underline 2px rgba(250, 231, 17, 0.95);
        }

        ::highlight(${HIGHLIGHT_NAMES.dataDeletion}) {
            background: rgba(139, 94, 60, 0.25);
            text-decoration: underline 2px rgba(139, 94, 60, 0.95);
        }

        ::highlight(${HIGHLIGHT_NAMES.policies}) {
            background: rgba(255, 105, 180, 0.22);
            text-decoration: underline 2px rgba(255, 105, 180, 0.95);
        }
    `;
        document.head.appendChild(style);
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

    function buildHighlightsForComments() {
        if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') {
            return;
        }

        ensureHighlightStyles();

        Object.values(HIGHLIGHT_NAMES).forEach(name => {
            CSS.highlights.delete(name);
        });

        const buckets = {
            g1: new Highlight(),
            g2: new Highlight(),
            dataDeletion: new Highlight(),
            policies: new Highlight()
        };

        document.querySelectorAll('.zd-comment').forEach(commentEl => {
            if (!commentEl) return;

            if (
                commentEl.matches?.('[contenteditable="true"], textarea, input, [role="textbox"], .zd-editor, .zendesk-editor') ||
                commentEl.querySelector?.('[contenteditable="true"], textarea, input, [role="textbox"], .zd-editor, .zendesk-editor')
            ) {
                return;
            }

            const textNodes = getReadableTextNodes(commentEl);

            textNodes.forEach(textNode => {
                const text = textNode.nodeValue;
                if (!text) return;

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

                        buckets[item.styleKey].add(range);

                        if (re.lastIndex === match.index) {
                            re.lastIndex++;
                        }
                    }
                });
            });
        });

        Object.entries(buckets).forEach(([styleKey, highlight]) => {
            CSS.highlights.set(HIGHLIGHT_NAMES[styleKey], highlight);
        });
    }

    function getMatchedStyle(text) {
        for (const item of allPatterns) {
            item.regex.lastIndex = 0;
            if (item.regex.test(text)) {
                return COLORS[item.styleKey];
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
        const matchedStyle = getMatchedStyle(value);

        if (!matchedStyle) {
            el.style.background = '';
            el.style.border = '';
            el.style.borderRadius = '';
            el.style.boxShadow = '';
            return;
        }

        const parsed = cssTextToObject(matchedStyle);

        if (parsed.background) el.style.background = parsed.background;
        if (parsed.border) el.style.border = parsed.border;
        if (parsed.borderRadius) el.style.borderRadius = parsed.borderRadius;

        el.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.05)';
    }

    function scanComments() {
        buildHighlightsForComments();
    }

    function scanSubjects() {
        document.querySelectorAll('input[data-test-id="omni-header-subject"]').forEach(el => {
            highlightSubjectInput(el);

            if (!el.dataset.subjectListenerAttached) {
                el.addEventListener('input', () => highlightSubjectInput(el));
                el.dataset.subjectListenerAttached = 'true';
            }
        });
    }

    function scanAll() {
        scanComments();
        scanSubjects();
    }

    let scanTimer = null;

    function scheduleScanAll() {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(() => {
            scanAll();
        }, 120);
    }

    const observer = new MutationObserver(mutations => {
        let shouldHighlight = false;

        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
                shouldHighlight = true;
                break;
            }
        }

        if (shouldHighlight) {
            scheduleScanAll();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(scanAll, 1500);
    setTimeout(scanAll, 3000);

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(scanAll, 1500);
    setTimeout(scanAll, 3000);
})();
