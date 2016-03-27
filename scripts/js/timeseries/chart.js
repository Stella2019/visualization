function TimeseriesChart(app, type) {
    this.app = app;
    
    // Size
    this.page = {};
    this.getPageBounds();
    
    this.placement = 1; // use this to move charts around
    this.top    = 10;
    this.right  = 10;
    this.bottom = 100;
    this.left   = 75;
    this.width  = this.page.width  - this.left - this.right;
    this.height = this.page.height - this.top  - this.bottom;
    
    // Scales
    this.x = d3.time.scale();
    this.y = d3.scale.linear();
    this.y2 = d3.scale.linear();
    
    // Axes
    this.xAxis = d3.svg.axis()
        .scale(this.x)
        .orient('bottom');
    this.yAxis = d3.svg.axis()
        .scale(this.y)
        .orient('left');
    this.yAxis2 = d3.svg.axis()
        .scale(this.y2)
        .orient('right');
    
    // Getters
    this.dataTimestamp_2_x = function(d) { return this.x(d.timestamp); };
    this.dataValue_2_y     = function(d) { return this.y(d.value);     };
    
    // Area
    this.area = d3.svg.area()
        .x(this.dataTimestamp_2_x);
    this.area2 = d3.svg.area()
        .x(this.dataTimestamp_2_x);
    
    // Other potential attributes
    this.brush = [];
    this.svg = [];
    
    this.init();
}

TimeseriesChart.prototype = {
    init: function() {
        this.setTriggers();
    },
    setTriggers: function() {
        triggers.on('page_built2', this.build.bind(this));
        triggers.on('resized', this.build.bind(this));
    },
    build: function() {
        this.adjustSize();
        this.updateOptionalAttributes();
        // disp.setColorScale
    },
    getPageBounds: function() {
        this.page.height = parseInt(d3.select('body').style('height').replace('px', ''));
        this.page.width  = parseInt(d3.select('body').style('width').replace('px', ''));
    },
    adjustSize: function(args) {
        
        
        this.x.range([0, this.width]);
        this.y.range([this.height, 0]);
        this.y2.range([this.height, 0]);
        
        this.xAxis.tickSize(-this.height)
        
        this.area.y0(this.height)
    },
    updateOptionalAttributes: function() {
        this.area.interpolate(options.shape.get());
    },
    addToDocument: function() {
        this.svg = disp.plot_area.svg.append("g")
            .attr("class", "focus")
            .attr("transform", "translate(" + this.left + "," + this.top + ")");
        
        this.svg.append("text")
            .attr('id', 'y_label')
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - this.left)
            .attr("x", 0 - (this.height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .text("Count of <Subset> Tweets Every <Resolution>");

        this.svg.append("path")
            .attr('class', 'column_hover')
            .style('display', 'none')
            .style('fill', 'black')
            .style('stroke', 'black')
            .style('fill-opacity', '0.2')
            .style('stroke-opacity', '0.6');
    },
    setContext: function () {
        this.area.y1(this.dataValue_2_y);
        
        this.brush = d3.svg.brush()
            .x(this.x)
            .on("brush", function() { disp.setFocusTime('brush'); } );
    }
};