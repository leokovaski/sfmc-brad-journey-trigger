define(['postmonger'], function (Postmonger) {
    'use strict';

    var connection = new Postmonger.Session();

    $(window).ready(onRender);
    connection.on('initActivityRunningModal', initialize);

    function onRender() {
        connection.trigger('ready');
    }

    function initialize(data) {
        var inArguments = data.arguments.execute.inArguments;
        var uuidArg = inArguments.find(arg => arg.uuid);
        var uuid = uuidArg ? uuidArg.uuid : null;
        var selectedJourneyName = inArguments.find(arg => arg.selectedJourneyName).selectedJourneyName;

        $('#selected-journey').text(`Jornada selecionada: "${selectedJourneyName}"`);

        if (uuid) {
            fetch(`/activity/${uuid}`)
                .then(response => response.json())
                .then(activityData => {
                    populateTable(activityData);
                })
                .catch(error => console.error('Erro ao buscar dados:', error));
        } else {
            console.error('UUID not found in inArguments');
        }
    }

    function populateTable(activityData) {
        var tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>ContactKey</th>
                        <th>Data do trigger</th>
                        <th>Status</th>
                        <th>Log de erro</th>
                    </tr>
                </thead>
                <tbody>
                    ${activityData.map(entry => `
                        <tr>
                            <td>${entry.contact_key}</td>
                            <td>${new Date(entry.trigger_date).toLocaleDateString()}</td>
                            <td>${entry.status}</td>
                            <td>${entry.error_log || ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        $('#activity-data').html(tableHtml);
    }
});
