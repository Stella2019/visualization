function Chart() {
    // internals
    var self = this;
    
    // Size
    plot_area = disp.plot_area; // maybe not
    self.placement = 1; // use this to move charts around
    self.top    = 10;
    self.right  = 10;
    self.bottom = 100;
    self.left   = 75;
    self.width  = plot_area.width  - self.left - self.right;
    self.height = plot_area.height - self.top  - self.bottom;
    
    // Scales
    self.x = d3.time.scale();
    self.y = d3.scale.linear();
    self.y2 = d3.scale_linear();
    
    // Axes
    self.xAxis = d3.svg.axis()
        .scale(self.x)
        .orient('bottom');
    self.yAxis = d3.svg.axis()
        .scale(self.y)
        .orient('left');
    self.yAxis2 = d3.svg.axis()
        .scale(self.y2)
        .orient('right');
    
    // Getters
    self.dataTimestamp_2_x = function(d) { return self.x(d.timestamp); };
    self.dataValue_2_y = function(d) { return self.y(d.value); };
    
    // Area
    self.area = d3.svg.area()
        .x(self.dataTimestamp_2_x);
    self.area2 = d3.svg.area()
        .x(self.dataTimestamp_2_x);
    
    // Other potential attributes
    self.brush = [];
    self.svg = [];
}

Chart.prototype = {
    init: function() {
        this.adjustSize();
        this.updateOptionalAttributes();
        // disp.setColorScale
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
    
    // functions
};