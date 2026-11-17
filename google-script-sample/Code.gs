// SAMPLE ONLY - dummy data, nothing is saved or emailed.
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Page')
    .setTitle('DERMACON - Confirm your lectures')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getData() {
  return {
    name: 'Dr. Sample Faculty',
    lectures: [
      { id: 1, code: 'SS01', name: 'Update on Psoriasis Biologics', hall: 'Hall A', time: '10 Jan, 09:00' },
      { id: 2, code: 'SS07', name: 'Hair Transplant Pearls', hall: 'Hall B', time: '10 Jan, 11:30' },
      { id: 3, code: 'WS02', name: 'Hands-on: Chemical Peels', hall: 'Workshop 1', time: '11 Jan, 14:00' },
      { id: 4, code: 'SS15', name: 'Pediatric Dermatology Cases', hall: 'Hall A', time: '12 Jan, 16:00' }
    ]
  };
}

function submitConfirmation(payload) {
  Logger.log(JSON.stringify(payload));
  return { ok: true };
}
