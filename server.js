const LineByLineReader = require('line-by-line'), 
	JSONStream = require('JSONStream'),
	PriorityQueue = require('priorityqueuejs'),
	path = require('path'),
	express = require('express'),
	app = express();

var topPapers;
var topAuthors;
var publicationYearsResult;
var recompiledMap;
var nodes;
var nodesMap;
var links;
var topPapersOutCitations;

main();

function main() {
	parse();
}

function parse() {
	var lr = new LineByLineReader('data.json');
	var maps = new Array();

	console.log("Loading data.json...");
	lr.on('error', function (err) {
		console.log("error!");
	});
	lr.on('line', function (line) {
		lr.pause();
		var map = JSON.parse(line);
		maps.push(map)
		lr.resume();
	});
	lr.on('end', function() {
		console.log("Completed loading data.json.");
		console.log("Parsing data.json...");
		console.log("Completed parsing data.json.");
		processMap(maps, 'arXiv');
		serve();
	});
}

function serve() {
	app.use(express.static(__dirname + '/static'));
	app.listen(process.env.PORT || 8080, function() {
		console.log("Serving the app on 8080...");
	});
	app.get('/', function(req, res) {
		res.send("Welcome to D3!");
	});
	app.get('/Q1', function(req, res) {
		res.sendFile(path.join(__dirname + '/static/q1.html'));
	});
	app.get('/Q2', function(req, res) {
		res.sendFile(path.join(__dirname + '/static/q2.html'));
	});
	app.get('/Q3', function(req, res) {
		res.sendFile(path.join(__dirname + '/static/q3.html'));
	});
	app.get('/Q4', function(req, res) {
		res.sendFile(path.join(__dirname + '/static/q4.html'));
	});
	app.get('/Q5', function(req, res) {
		res.sendFile(path.join(__dirname + '/static/q5.html'));
	});
	app.get('/top_papers', function(req, res) {
		res.send(topPapers);
	});
	app.get('/top_authors', function(req, res) {
		res.send(topAuthors);
	});
	app.get('/publication_years', function(req, res) {
		res.send(publicationYearsResult);
	});
	app.get('/recompiledMap', function(req, res) {
		res.send(recompiledMap);
	});
	app.get('/web_elements', function(req, res) {
		res.send({ nodes: nodes, links: links });
	});
	app.get('/top_out_citations', function(req, res) {
		res.send(topPapersOutCitations);
	})
}

function processMap(maps, venue) {
	venue = venue.toLowerCase(); // search key
	var titleKey = 'Low-density parity check codes over GF(q)'.toLowerCase();

	var relatedAuthors = new Object();
	var paperCitations = new Object();
	var publicationYears = new Object();
	var papersOutCitations = new Object();
	nodes = new Array();
	links = new Array();
	recompiledMap = new Object();
	var basePapers = new Array();
	for (var i = 0; i < maps.length; i++) {
		var id = maps[i]["id"];
		if (maps[i] && maps[i]["venue"] && maps[i]["venue"].toLowerCase().includes(venue)) {
			// Q1 top authors			
			for (var j=0; j<maps[i]["authors"].length; j++) {
				var name = maps[i]["authors"][j]["name"];
				var id = maps[i]["authors"][j]["ids"];
				if (relatedAuthors[id] == undefined) {
					relatedAuthors[id] = { name: name, nCitations: 1 };
				} else relatedAuthors[id]["nCitations"]++;
			}

			// Q2 top papers
			var nInCitations = maps[i]["inCitations"].length;
			if (paperCitations[id]) paperCitations[id]["nInCitations"]+=nInCitations;
			else paperCitations[id] = { nInCitations: nInCitations, title: maps[i]["title"] }
		}
		// Q3 trends
		if (maps[i]["venue"].toLowerCase().includes("icse")) {
			var year = maps[i]["year"];

			if (publicationYears[year]) publicationYears[year]++;
			else publicationYears[year] = 1;
		}
		// Q4
		recompiledMap[id] = maps[i];
		if (maps[i]["title"].toLowerCase().includes(titleKey)) basePapers.push(id);

		//Q5
		var nInCitations = maps[i]["outCitations"].length;
		if (papersOutCitations[id]) papersOutCitations[id]["nInCitations"]+=nInCitations;
		else papersOutCitations[id] = { nInCitations: nInCitations, title: maps[i]["title"] }
	}

	var pqAuthors = new PriorityQueue(function (a, b) {
		return a.nCitations - b.nCitations;
	});
	// sorting by priority queue
	for (var key in relatedAuthors) {
		pqAuthors.enq({
			id: +key, 
			name: relatedAuthors[key]["name"], 
			nCitations: relatedAuthors[key]["nCitations"],
			enabled: true
		})
	}
	topAuthors = new Array();
	for (var i=0; i<10; i++) {
		if (pqAuthors.size()>0) topAuthors.push(pqAuthors.deq());
	}
	var pqCitations = new PriorityQueue(function (a, b) {
		return a.nInCitations - b.nInCitations;
	});
	for (var key in paperCitations) {
		pqCitations.enq({
			id: key, 
			title: paperCitations[key]["title"], 
			nInCitations: paperCitations[key]["nInCitations"],
			enabled: true
		})
	}
	topPapers = new Array();
	for (var i=0; i<5; i++) {
		if (pqCitations.size()>0) topPapers.push(pqCitations.deq());
	}

	Object.keys(publicationYears).sort();
	publicationYearsResult = new Array();
	for (var year in publicationYears) {
		publicationYearsResult.push({
			year: Date.parse(year),
			noOfPub: +publicationYears[year]
		});
	}

	console.log(basePapers);
	for (var i = 0; i < basePapers.length; i++) {
		generateNodes(recompiledMap, basePapers[i], 0);
	}
	console.log(nodes);
	console.log(links);

	//Q5
	pqCitations = new PriorityQueue(function (a, b) {
		return a.nInCitations - b.nInCitations;
	});
	for (var key in papersOutCitations) {
		pqCitations.enq({
			id: key, 
			title: papersOutCitations[key]["title"], 
			nInCitations: papersOutCitations[key]["nInCitations"],
			enabled: true
		})
	}
	topPapersOutCitations = new Array();
	for (var i=0; i<10; i++) {
		if (pqCitations.size()>0) topPapersOutCitations.push(pqCitations.deq());
	}
}

function generateNodes(map, node, nNest) {
	if (nNest<=2 && node && map[node]) {
		nodes.push({
			id: map[node]["id"],
			title: map[node]["title"],
			authors: map[node]["authors"],
			year: map[node]["year"],
			venue: map[node]["venue"],
			group: nNest+1
		});

		var targets = map[node]["inCitations"];
		for (var i = 0; i < targets.length; i++) {
			if (map[targets[i]]) {
				if (generateNodes(map, targets[i], nNest+1)) {
					links.push({
						source: node,
						target: targets[i]
					});
				}
			}
		}
		return true;
	} else return false;
}