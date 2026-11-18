function createPrivacyOptions({ document, getAdMob, onOptionsClosed = () => {} }) {
  let allowed = false;
  let optionsRequired = false;
  let openingOptions = false;
  let initialRequest;

  function canRequestAds() {
    return allowed && !openingOptions;
  }

  function updateButton() {
    let button = document.querySelector('#hlPrivacyOptions');
    if (!optionsRequired) {
      button?.remove();
      return;
    }
    if (!button) {
      const privacyLink = document.querySelector('#ov:not([hidden]) .legal a[href="privacy.html"]');
      const sheet = privacyLink?.closest('.sheet');
      const row = sheet?.querySelector('.btn-row');
      if (!row) return;

      button = document.createElement('button');
      button.id = 'hlPrivacyOptions';
      button.type = 'button';
      button.className = 'btn';
      button.textContent = 'Privacy choices';
      button.addEventListener('click', showPrivacyOptions);
      row.insertBefore(button, sheet.querySelector('#ovClose'));
    }
    button.disabled = openingOptions;
  }

  async function requestConsent(showInitialForm) {
    allowed = false;
    const AdMob = getAdMob();
    if (!AdMob) return;
    let info;
    try {
      info = await AdMob.requestConsentInfo({});
      if (showInitialForm && info?.isConsentFormAvailable) info = await AdMob.showConsentForm();
      allowed = info?.canRequestAds === true;
    } catch {
      // The bridge does not return consent information on an SDK error.
      // Keep play available and wait for a successful consent check before serving ads.
    }
    if (info) optionsRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
    updateButton();
  }

  async function showPrivacyOptions() {
    if (!optionsRequired || openingOptions) return;
    openingOptions = true;
    updateButton();
    try {
      await getAdMob().showPrivacyOptionsForm();
    } catch {
      // Refresh even on failure so a stale ad permission never survives a form attempt.
    } finally {
      await requestConsent(false);
      openingOptions = false;
      updateButton();
      onOptionsClosed(canRequestAds());
    }
  }

  document.addEventListener('click', event => {
    // The About handler renders the sheet before the activation reaches document.
    if (event.target.closest?.('#infoBtn')) updateButton();
  });

  return {
    canRequestAds,
    gatherConsent() {
      if (!initialRequest) initialRequest = requestConsent(true);
      return initialRequest.then(canRequestAds);
    },
  };
}

module.exports = { createPrivacyOptions };
