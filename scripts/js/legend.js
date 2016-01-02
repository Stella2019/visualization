function Legend() {
    self = this;
    self.container = [];
    self.container_series = [];
    self.data = [];
    self.mouseOverToggle = false;
    self.mouseOverToggleState = true;
    
    // Function
    self.startToggle = function(series) {
        self.mouseOverToggle = true;
        self.mouseOverToggleState = !series.shown;
        self.toggleSeries(series); 
        d3.event.stopPropagation();
    };
    self.endToggle = function(series) {
        if(self.mouseOverToggle) {
            self.mouseOverToggle = false;
            
//            var arr_selected = self.data.map(function(series) {
//                return series.id + ':' + (series.shown ? 1 : 0);
//            });
//            options.terms_selected.set(arr_selected.join(","));
            
//            options.recordState(options, 'terms_selected');
            prepareData(); 
        }
    };
    self.highlightSeries = function(series) {
        var id;
        if((typeof series) != "string")
            id = series.id;
        else
            id = series;

        d3.selectAll('.series, .legend_icon')
            .classed('focused', false)
            .classed('unfocused', true);
        d3.selectAll('.series.' + series.id + ', .' + series.id + ' .legend_icon')
            .classed('unfocused', false)
            .classed('focused', true);
    };
    self.hoverLegendEntry = function(series) {
        var others_shown = self.data.reduce(function(others_shown, inner_series) {
            if(inner_series.id != series.id)
                others_shown |= inner_series.shown; 
            return others_shown;
        }, false);
        
        d3.selectAll('.legend_only')
            .style('display', 'none');
        d3.selectAll('.' + series.id + ' .legend_only')
            .style('display', 'block')
            .text(others_shown ? 'only' : 'show all');
        
        self.highlightSeries(series);
    };
    self.hoverLegendEntryEnd = function(series) {
        d3.selectAll('.' + series.id + ' .legend_only')
            .style('display', 'none');
        
        self.unHighlightSeries(series);
    };
    self.unHighlightSeries = function(series) {
        d3.selectAll('.series, .legend_icon')
            .classed('focused', false)
            .classed('unfocused', false);
    };
    self.toggleSeries = function(series) { //chooseKeyword
        series.shown = !series.shown;
        d3.select('.' + series.id + ' .legend_icon')
            .classed('off', !series.shown);

        if(!self.mouseOverToggle) {
//            self.mouseOverToggle = true; // weird hack
//            self.endToggle();
            prepareData();
        }
    };
    self.toggleSingle = function(series) { //chooseKeyword
        // Figure out if this is the only series being shown
        var turnAllOff = self.data.reduce(function(others_shown, inner_series) {
            if(inner_series.id != series.id)
                others_shown |= inner_series.shown; 
            return others_shown;
        }, false);
        
        self.data.map(function(inner_series) {
            inner_series.shown = !turnAllOff; 
        }, this);
        
        series.shown = true;
        
        d3.selectAll('.legend_icon')
            .classed('off', turnAllOff);
        d3.select('.' + series.id + ' .legend_icon')
            .classed('off', false);
        d3.select('.' + series.id + ' .legend_only')
            .text(turnAllOff ? 'show all' : 'only');

        prepareData();
    };
    self.hoverOverSeries = function(series) { //chooseKeyword
        if(self.mouseOverToggle && series.shown != self.mouseOverToggleState) {
            self.toggleSeries(series);
        }
    };
}

Legend.prototype = {
    init: function() {
        this.container = d3.select('#legend');
        
        this.container.append('div')
            .attr('class', 'legend_title text-center')
            .style({'font-weight': 'bold', margin: '5px'})
            .text('Terms');
        
        this.container_series = this.container.append('div')
            .attr('class', 'legend_part')
            .data(['legend_active']);
        
        var legend_key = this.container.append('div')
            .attr('id', 'legend_key')
            .append('dl').selectAll()
            .data([
                {term: "&nbsp;", label: "Final Capture Term"},
                {term: "&#x271d;", label: "Old Capture Term"},
                {term: "*", label: "New Term"}
            ]);
        
       legend_key.enter().insert("dt").html(function(d) { return d.term });
       legend_key.enter().insert("dd").html(function(d) { return d.label });
                    
    },
    populate: function(series_data) {
        // Save data
        this.data = series_data;
        
        // Get series data
        this.data.map(function(series) {
            series.shown = true; 
        }, this);
        
//        var terms_selected = options.terms_selected.get();
//        if(terms_selected.length > 0) {
//            var terms_selected_dict = {};
//            console.log(terms_selected);
//            terms_selected.split(',').map(function(term_pair) {
//                var kv = term_pair.split(':');
//                terms_selected_dict[kv[0]] = kv[1] == "1";
//            }, this);
//            
//            this.data.map(function(series) {
//                if(terms_selected_dict[series.id] !== undefined) {
//                    series.shown = terms_selected_dict[series.id];
//                }
//            });
//        }
        
        
        this.container.select('.legend_title')
            .html(options.series.getLabel());
        d3.select('#legend_key')
            .style('display', (options.series.is('terms') ? 'block' : 'none'));
        
        // Add new entries
        var entries = this.container_series
            .selectAll('div.legend_entry')
            .data(this.data);

        var new_entries = entries.enter().append('div')
            .attr('id', function(d) {
                return 'legend_' + d.id;
            })
            .attr('class', function(d) {
                return 'legend_entry ' + d.id;
            })
            .on('mouseover', this.hoverLegendEntry)
            .on('mouseout', this.hoverLegendEntryEnd);

        new_entries.append('svg')
            .attr({
                class: "legend_icon_svg",
                width: 25, height: 25
            })
            .on('mousedown', this.startToggle)
            .on('mouseover', this.hoverOverSeries)
            .on('mouseup', this.endToggle)
            .append('rect')
            .attr({
                class: "legend_icon",
                x: 2.5, y: 2.5,
                rx: 5, ry: 5,
                width: 20, height: 20
            });

        new_entries.append('div')
            .attr('class', 'legend_label');
        
        new_entries.append('div')
            .attr('class', 'legend_only')
            .text('only')
            .style('display', 'none')
            .on('click', this.toggleSingle);

        // Remove entries
        entries.exit().remove();
        entries.select('svg');
        entries.select('div.legend_label');
        entries.select('div.legend_only');

        entries
            .attr('id', function(d) {
                return 'legend_' + d.id;
            })
            .attr('class', function(d) {
                return 'legend_entry ' + d.id;
            });
        
        this.container_series.on('mouseout', function(d) {
            d3.event.stopPropagation();
        });
        this.container.on('mouseout', self.endToggle);

//        this.container.selectAll('rect.legend_icon')
//            .classed('off', function(d) {
//                return !d.shown;
//            });
        this.container.selectAll('rect.legend_icon')
            .classed('off', false);

        this.container.selectAll('div.legend_label')
            .html(function (d) {
                var name = d.name;
                if(options.series.is('terms')) {
                    if(d.isOldKeyword)
                        name += ' &#x271d;';
                    else if(!d.isKeyword)
                        name += ' *';
                }
                return name;
            });
    }
}