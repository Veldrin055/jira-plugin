import mergeWith from 'lodash.mergewith';
const maxResults = 100;

export default async function topReporters(project, httpClient) {
    let startAt = 0;
    let result = await callService(httpClient, project, startAt);
    let { topReporters } = result;
    console.log(result);
    while (result.total >= maxResults) { // Pagination
        startAt += result.total;
        result = await callService(httpClient, project);
        mergeWith(topReporters, result.topReporters, (objValue, srcValue) => objValue + srcValue);
    }
    // Pull the object out into a array of tuples and sort the result.
    return Object.entries(topReporters)
        .map(([key, value]) => {return {name: key, requests: value}}) // Normalise with better object field names
        .sort((a, b) => b.requests - a.requests) // Only sorting on requests at the moment. There's no other tie breakers for equality.
}

function callService(httpClient, project, startAt) {
    // Assemble our JQL request object
    const jql = {
        jql: `project = ${project}`,
        fieldsByKeys: false,
        fields: [
            "reporter" // We're only interested in the reporters of an issue, so that's all we want back.
            // This will keep response objects smaller to reduce network traffic and hopefully be less expensive for the server to handle as well.
        ],
        maxResults,
        startAt,
    };

    return new Promise((resolve, reject) => {
        /* Make a API call using JQL to get all the issues in the given project. For this simple rough POC, it works fine. But at scale (many requests, many customers...or many of both!) it won't handle well.
        For starters: page offset. I'll need to handle this recursivly as it will only return max 100. I'll do this tomorrow if I have time :) EDIT I did have time
        For lots of issues, the cost of the operation could be prohibitive. Not being privy to the backend, I'm not sure on what the performance of a JQL query is like compared to other methods. It's nice and simple for me however :)
        For lots of users I'll have to worry about memory on my addon app side, as I'm adding to my object over time. This could be limited by using a ceiling on the maximum number of requestors I'm interested in, and replacing reporters when another
        with a higher value comes along, or some better state management (see next line)
        Finally, this is a dumb pull-based request. It doesn't cache anything or keep any state, every time the addon is requested it will query the server again. A more sensible approach would be to maintain some state, either in memory or in a simple
        database. This query can be used to create the snapshot at start-up, and then webhooks can be created to subscribe to when a new issue is created or a reporter for an issue is assigned (updated). Then we will only need to modify the running totals
        that are kept in state, and when a query comes we only need to retrieve the values from state instead of having to query the JIRA server.
        I'm also using POST because the query structure looks much clearer and easier to read in a JSON body than a big list of query params.
        */
        httpClient.post({
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(jql),
                url: '/rest/api/2/search',
            },
            (err, response, body) => {
                if (err) { // Note that this could be handled better, this is really simple error handling. Better would be to have it properly templated on the front end.
                    console.log(response.statusCode + ": " + err);
                    reject("Error: " + response.statusCode + ": " + err);
                }
                else {
                    const json = JSON.parse(body);
                    const { issues, total } = json;
                    // If the response contains issues we group them, otherwise just give an empty array.
                    const topReporters = issues ? issues.reduce((grouped, item) => {
                        let group_value = item.fields.reporter.emailAddress; // We are grouping on the user's email address for the purpose of this example. 
                        // A better result would be to group on the user's ID, then we can pull all their information in a subsequent request for a richer frontend experience.
                        if (!grouped[group_value]) {
                            grouped[group_value] = 0 // New, set a default (zero) value
                        }
                        grouped[group_value] = grouped[group_value] + 1; // Increment total
                        return grouped
                    }, {}) : [];
                    resolve({ topReporters, total });
                }
            }
        );
    });
}