var jsdom = require("jsdom"),
    diff = require('diff');

jsdom.defaultDocumentFeatures = {
    FetchExternalResources: false,
    ProcessExternalResources: false,
    MutationEvents: false,
    QuerySelector: false
}

function trim(s) {
    return s.replace(/(^\s+)|(\s+$)/g, "");
}

function format_node(node, path) {
    var prefix = path.join(" > ") + " > " + node.nodeName;
    if (node.nodeName == "#text") {
        var s = trim(node.textContent);
        return prefix + " (" + s.length + ", " + s + ")\n";
    }
    else if (node.nodeName == "IMG") {
        return prefix + "(" + node.getAttribute("src") + ")\n";
    }
    return "";
}

function skip_traverse(node, url){
    // Skip specific types of nodes
    var tags = ["HEAD", "NOSCRIPT", "SCRIPT", "#comment", "TEXTAREA"];
    if (tags.indexOf(node.nodeName) != -1) {
        return true;
    }
    // Skip empty text nodes
    else if (node.nodeName == "#text" && trim(node.textContent) == "") {
        return true;
    }
    // Skip hidden nodes
    else if (node.style && node.style.display == "none") {
        return true;
    }
    return false;
}

function node_identifier(node) {
    var id = node.nodeName;
    //if (node.id != "") {
    //    id += "#" + node.id + "";
    //}
    //else if (node.className != "") {
    //    id += node.className.split(" ").join(" .") + "";
    //}
    return id;
}

function traverse(node, path, url) {
    var out = "";
    var children = node.childNodes;
    for (var i = 0, len = children.length; i < len; i++) {
        var child = children[i];
        if (skip_traverse(child, url)) continue;
        var new_path = path.slice(0);
        new_path.push(node_identifier(node));
        out += format_node(child, new_path);
        out += traverse(child, new_path);
    }
    return out;
}

function filter_out(s) {
    var lines = s.split("\n");

    var good_lines = 0, listy_lines = 0;
    for (var i = 0, len = lines.length; i < len; i++) {
        var line = lines[i];
        if (line.indexOf("> UL >") != -1) {
            listy_lines++;
        }
        var res = /> #text \((\d+), /.exec(line);
        if (res && parseInt(res[1]) > 100) {
            good_lines++;
        }
    }

    // Heuristic #1: Remove things that looks like lists
    if (listy_lines >= Math.min(5, lines.length) && good_lines < listy_lines/2) {
        //console.log("filter_out: looks listy")
        return true;
    }

    // Heuristic #2: Remove short things with very little text
    if (good_lines == 0) {
        //console.log("filter_out: remove short things")
        return true;
    }
    return false;
}

function diff_helper(article1, article2) {
    var diffs = diff.diffLines(article1, article2);
    var changes = [];
    for (var i = 0, len = diffs.length; i < len; i++) {
        if (diffs[i].removed && !filter_out(diffs[i].value)) {
            changes.push(diffs[i]);
        }
    }
    return changes;
}

function compare_urls(url1, url2) {
    jsdom.env(url1, function(err, window1) {
        var article1 = traverse(window1.document.body, [], url1);
        jsdom.env(url2, function(err, window2){
            var article2 = traverse(window2.document.body, [], url2);
            var diffs = diff_helper(article1, article2);
            diffs.forEach(function(change){
                filter_out(change.value);
                console.log(change.value);
            });
        });
    });
}

var arguments = process.argv.splice(2);
if (arguments.length != 2) {
    console.log("Syntax: node scrape.js <url1> <url2>");
    process.exit();
}
// Run the shit!
compare_urls(arguments[0], arguments[1]);
