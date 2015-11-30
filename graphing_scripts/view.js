function View(controller) {
    this.controller = controller;
    
    // Initialize Options
    var options = {
        display_type: {
            labels: ["Stacked", "Overlap", "Stream", "Separate", "100%"],
            ids:    ["stacked", "overlap", "stream", "separate", "percent"],
            available: [0, 1, 2, 3, 4],
            default: 0, cur: "stacked",
            callback: function() { console.log('display_type callback') }//,
//            get () { return this;}
        },
        resolution: {
            labels: ["Day",     "Hour",    "10 Minute"],
            ids:    ["day",     "hour",    "tenminute"],
            available: [0, 1, 2],
            default: 1, cur: "hour",
            callback: function() { console.log('resolution callback') }
        },
        y_scale: {
            labels: ["Linear",  "Power",   "Log"],
            ids:    ["linear",  "pow",     "log"],
            available: [0, 1, 2],
            default: 0, cur: "linear",
            callback: function() { console.log('y_scale callback') }
        },
        subset: {
            labels: ["All",     "Unique"],
            ids:    ["all",     "unique"],
            available: [0, 1],
            default: 0, cur: "all",
            callback: function() { console.log('subset callback') }
        },
        shape: {
            labels: ["Linear",  "Basis",   "Step"],
            ids:    ["linear",  "basis",   "step"],
            available: [0, 1, 2],
            default: 1, cur: "basis",
            callback: function() { console.log('shape callback') }
        }
    };
    
    // Initialize plot areas
    var plot_area = {
        padding: {
            top: 10,
            right: 10,
            bottom: 20,
            left: 80
        }
    };
    var focus = {
        top: 10,
        left: 80,
        width: 870,
        height: 400
    };
    var context = {
        top: 10 + 400 + 10,
        left: 80,
        width: 870,
        height: 80
    };
    plot_area.width = plot_area.padding.left + focus.width + plot_area.padding.right;
    plot_area.height = plot_area.padding.top + focus.height + plot_area.padding.top + context.height + plot_area.padding.bottom;
    
    $.extend(focus, {
        x: d3.time.scale().range([0, focus.width]),
        y: d3.scale.linear().range([focus.height, 0]),
        xAxis: d3.svg.axis()
            .scale(focus.x)
            .tickSize(-focus.height)
            .orient("bottom"),
        yAxis: d3.svg.axis()
            .scale(focus.y)
            .orient("left"),
        area: d3.svg.area()
            .interpolate(options.shape.cur)
            .x(function (d) { console.log(this); return this.x(d.timestamp); })
    });
    $.extend(context, {
        x: d3.time.scale()
            .range([0, context.width]),
        y: d3.scale.linear()
            .range([context.height, 0]),
        xAxis: d3.svg.axis()
            .scale(context.x)
            .orient("bottom"),
        yAxis: d3.svg.axis()
            .scale(context.y)
            .ticks(2)
            .orient("left"),
        area: d3.svg.area()
            .interpolate(options.shape.cur)
            .x(function(d) { return this.x(d.timestamp); })
            .y0(context.height)
            .y1(function(d) { return this.y(d.tweets); })
    });
    
    // Add these to the view
    this.plot_area = plot_area;
    this.focus = focus;
    this.context = context;
    this.options = options;
    
    // Other functions
    this.brush = d3.svg.brush()
        .x(context.x);
    
    this.buildButton = function(option) {
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

                set.callback();
            });

        container.select('#' + set.ids[set.default]).classed('active', true);
//        this.options.cur[type] = values[this.options.default[option]].id;
    }
}

View.prototype = {
    parseDate: d3.time.format("%Y%m%d_%H%M").parse,
    color: d3.scale.category10(),
    drag: d3.behavior.drag(),
    brushed: function() { return this; },
//    
//        .x(this.context.x)
//        .on("brush", this.brushed),
    init: function() {
        this.brush.on("brush", this.brushed)
    },
    buildInterface: function () {
        // Build buttons
        Object.keys(this.options).map(this.buildButton);
        
        // Create SVG elements
        this.buildSVG();
        
        // Add legend
        this.buildLegend();
        
    },
    buildSVG: function() {
        this.plot_area.svg = d3.select("svg#timeseries")
            .attr("width", this.plot_area.width)
            .attr("height", this.plot_area.height);

        this.focus.svg = this.plot_area.svg.append("g")
            .attr("class", "focus")
            .attr("transform", "translate(" + this.focus.left + "," + this.focus.top + ")");

        this.context.svg = this.plot_area.svg.append("g")
            .attr("class", "context")
            .attr("transform", "translate(" + this.context.left + "," + this.context.top + ")");    
        
    },
    buildLegend: function () {
        legend = {};
        legend.container = d3.select('#legend');
        
        legend.container_active = legend.container.append('div')
            .data(['legend_active']);
        legend.container_inactive = legend.container.append('div')
            .data(['legend_inactive']);
        
        var legend_parts = legend.container.selectAll('div')
            .attr('id', function(d) { return d; })
            .attr('class', 'legend_part')
            .attr('droppable', "")
            .on('dragover', function(d) {
                    d3.event.preventDefault();
                    legend.dragover = d;
            })
        
        legend_parts.append('div')
            .attr('class', 'legend_title text-center')
            .style({'font-weight': 'bold', margin: '5px'})
            .text(function(d) {
                if(d == 'legend_active') return 'Series';
                if(d == 'legend_inactive') return 'Hidden Series';
            });
        legend_parts.append('div')
            .attr('class', 'legend_drag_tip text-center')
            .style({'font-style': 'italic', margin: '5px', color: '#ddd'})
            .style('display', 'none')
            .text(function(d) {
                if(d == 'legend_active') return 'Drag items to here to show';
                if(d == 'legend_inactive') return 'Drag items to here to hide';
            });
        
        this.legend = legend;
        this.legend_parts = legend_parts;
    },
    populateCollectionList: function(collection_names) {
        var select  = d3.select("select#chooseCollection").on('change', control.newDataset);
        var options = select.selectAll("option").data(collection_names);

        options.enter()
            .append("option").text(function (d) { return d; });
    },
    populateLegend: function() {
        
    }
}