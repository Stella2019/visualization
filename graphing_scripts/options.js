function Option(args) {
    this.labels = args.labels;
    this.ids = args.ids;
    this.available = args.available;
    this.default = args.default;
    this.cur = this.ids[this.default];
    this.callback = args.callback;
};
Option.prototype = {
    get: function() { return this.cur; },
    set: function(choice) { this.cur = choice},
    is: function(choice) { return this.cur == choice},
};

function Options() {
    var options = {};
    options.sets = ['display_type', 'resolution', 'y_scale', 'subset', 'shape']; 
    
    options.display_type = new Option({
            labels: ["Stacked", "Lines", "Stream", "Separate", "100%"],
            ids:    ["stacked", "lines", "stream", "separate", "percent"],
            available: [0, 1, 2, 3, 4],
            default: 0,
            callback: function() { chooseDisplayType(); }
        });
    options.resolution = new Option({
            labels: ["Day",     "Hour",    "10 Minute"],
            ids:    ["day",     "hour",    "tenminute"],
            available: [0, 1, 2],
            default: 1,
            callback: function() { prepareData(); }
        });
    options.y_scale = new Option({
            labels: ["Linear",  "Power",   "Log"],
            ids:    ["linear",  "pow",     "log"],
            available: [0, 1, 2],
            default: 0,
            callback: function() { chooseYScale(); }
        });
    options.subset = new Option({
            labels: ["All", "First Instance", "Original", "Retweet", "Reply", "Quote"],
            ids:    ["all", "unique", "original", "retweet", "reply", "quote"],
            available: [0, 1, 2, 3, 4, 5],
            default: 0,
            callback: function() { changeData(); }
        });
    options.shape = new Option({
            labels: ["Linear",  "Basis",   "Step"],
            ids:    ["linear",  "basis",   "step"],
            available: [0, 1, 2],
            default: 1,
            callback: function() { prepareData(); }
        });
    
    this.sets = options.sets;
    this.display_type = options.display_type;
    this.resolution = options.resolution;
    this.y_scale = options.y_scale;
    this.subset = options.subset;
    this.shape = options.shape;
    this.buildButtonSet = function(option) {
        var set = options[option];

        var superId = "choose_" + option;
        var container = d3.select("#choices").append("div")
            .attr("class", "choice")
            .style("text-transform", "capitalize")
            .html(" " + option.replace("_", " ") + ": ")
            .append("div")
            .attr("id", superId)
            .attr("class", "btn-group");

        container.selectAll("button")
            .data(options[option].available)
            .enter()
            .append("button")
            .attr("type", "button")
            .attr("class", "btn btn-default")
            .attr("id", function(d) { return set.ids[d]; })
            .text(function(d) { return set.labels[d]; })
            .on("click", function(d) {
                container.select('.active').classed('active', false);
                container.select('#' + set.ids[d]).classed('active', true);
            
                set.set(set.ids[d]);

                set.callback();
            });

        container.select('#' + set.ids[set.default]).classed('active', true);
    };
};

Options.prototype = {
    init: function() {
        this.sets.map(this.buildButtonSet);

        d3.selectAll("#choose_y_scale button:not(#linear)")
            .attr("disabled", "");
    }
}
