export default function routes(app, addon, service) {
    // Redirect root path to /atlassian-connect.json,
    // which will be served by atlassian-connect-express.
    app.get('/', (req, res) => {
        res.redirect('/atlassian-connect.json');
    });

    // Note this probably too much code for a single route. A better idea would be to pull this out into a seperate function/module to make it
    // more testable and readable, especially if we add more routes later on or add more corner case checking.
    app.get('/top-reporters', addon.checkValidToken(), async (req, res) => {
        // project (service desk) ID comes from a query param that is provided by the URL in the Connect module.
        const project = req.query['projectId'];
        const httpClient = addon.httpClient(req);
        const topReporters = await service(project, httpClient);
        res.render('top-reporters', {
            topReporters,
        });
    });

    // Add additional route handlers here...(or not I don't really care)
}