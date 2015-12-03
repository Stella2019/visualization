function Option(args) {
    this.title = args.title;
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
    var self = this;
    
    var options = {};
    options.sets = ['collection', 'subset', 'resolution', '<br>',
                    'display_type', 'y_scale', 'shape']; 
    
    options.collection = new Option({
            title: "Collection",
            labels: ["none"],
            ids:    ["none"],
            available: [0],
            default: 0,
            callback: function() { loadCollectionData(); }
        });
    options.display_type = new Option({
            title: "Chart Type",
            labels: ["Stacked", "Overlap", "Lines", "Stream", "Separate", "100%"],
            ids:    ["stacked", "overlap", "lines", "stream", "separate", "percent"],
            available: [0, 1, 2, 3, 4],
            default: 0,
            callback: function() { display(); }
        });
    options.resolution = new Option({
            title: "Resolution",
            labels: ["Day",     "Hour",    "10 Minute"],
            ids:    ["day",     "hour",    "tenminute"],
            available: [0, 1, 2],
            default: 2,
            callback: function() { prepareData(); }
        });
    options.y_scale = new Option({
            title: "Y Scale",
            labels: ["Linear",  "Power", "Log", "Preserve"],
            ids:    ["linear",  "pow",   "log", "preserve"],
            available: [0, 1, 2, 3],
            default: 0,
            callback: function() { display(); }
        });
    options.subset = new Option({
            title: "Subset",
            labels: ["All", "Unique", "Original Tweets", "Retweets", "Replies", "Quotes"],
            ids:    ["all", "unique", "original", "retweet", "reply", "quote"],
            available: [0, 1, 2, 3, 4],
            default: 0,
            callback: function() { changeData(); }
        });
    options.shape = new Option({
            title: "Shape",
            labels: ["Linear",  "Basis",   "Step"],
            ids:    ["linear",  "basis",   "step"],
            available: [0, 1, 2],
            default: 1,
            callback: function() { prepareData(); }
        });
    options.series = new Option({
            title: "Series",
            labels: ["Terms", "Tweet Types"],
            ids:    ["terms", "types"],
            available: [0, 1],
            default: 0,
            callback: function() { console.log("Series changed"); }
        });
    
    this.sets = options.sets;
    
    this.collection = options.collection;
    this.display_type = options.display_type;
    this.resolution = options.resolution;
    this.y_scale = options.y_scale;
    this.subset = options.subset;
    this.shape = options.shape;
};

Options.prototype = {
    init: function() {
        this.sets.map(this.buildDropdown, this);
//        d3.selectAll("#choose_y_scale button:not(#linear)")
//            .attr("disabled", "");
    },
    buildButtonSet: function(option) {
        if(option == '<br>') {
            d3.select("#choices").append("br")
            return
        }
        
        var set = this[option];
        
        var container = d3.select("#choices").append("div")
            .attr("class", "choice")
            .style("text-transform", "capitalize")
            .html(" " + set.title + ": ")
            .append("div")
                .attr("id", superId)
                .attr("class", "btn-group");

        container.selectAll("button")
            .data(set.available)
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
    },
    buildDropdown: function(option) {
        if(option == '<br>') {
            d3.select("#choices").append("br")
            return
        }
        
        var set = this[option];

        var superId = "choose_" + option;
        var container = d3.select("#choices").append("div")
            .attr("class", "choice")
            .style("text-transform", "capitalize")
//            .html(" " + set.title + ": ")
            .append("div")
                .attr("id", superId)
                .attr("class", "dropdown");
        
        container.append("button")
            .attr({type: "button",
                class: 'btn btn-default dropdown-toggle',
                'data-toggle': "dropdown",
                'aria-haspopup': true,
                'aria-expanded': false})
            .html("<strong>" + set.title + ":</strong>" +
                  " <span class='current'>Label</span>" +
                  " <span class='caret'><span>");

        container.append('ul')
            .attr({class: 'dropdown-menu'})
            .selectAll("li")
                .data(set.available)
                .enter()
                .append("li").append("a")
                    .attr("id", function(d) { return option + "_" + set.ids[d]; })
                    .attr("href", "#")
                    .html(function(d) {
//                        return "<span style='opacity:0'> " + set.title + "&nbsp;</span>" +
//                            set.labels[d] + "&nbsp;";
                        return set.labels[d];
                    })
                    .on("click", function(d) {
                        container.select('.current')
                            .text(set.labels[d]);

                        set.set(set.ids[d]);

                        set.callback();
                    });

        container.select('.current')
            .text(set.labels[set.default]);
    }
}
