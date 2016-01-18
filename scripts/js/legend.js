function Legend() {
    var self = this;
    self.container = [];
    self.container_series = [];
    self.mouseOverToggle = false;
    self.mouseOverToggleState = true;
    self.key_data = [
        {term: "&nbsp;", label: "Capture Term", id: 'capture', has: false},
        {term: "&#x271d;", label: "Removed Capture Term", id: 'removed', has: false},
        {term: "*", label: "Term Added Later", id: 'added', has: false},
        {term: "<svg height=10 width=10><line x1=0 y1=10 x2=10 y2=0 class='total_line' /></svg>",
            label: "Tweet Volume", id: 'total_line', has: false}
    ];
     
    // Function
}

Legend.prototype = {
    init: function() {
        this.container = d3.select('#legend')
            .on('mouseout', this.endToggle);
        
        var legend_header = this.container.append('div')
            .attr('class', 'legend_header');
        
        legend_header.append('span')
            .attr('class', 'legend_title')
            .text('Terms')

        legend_header.append('div')
            .attr('class', 'legend_showall')
            .text('show all')
            .on('click', this.showAll);
        
        this.container_series = this.container.append('div')
            .attr('class', 'legend_series_list');
        
        this.key = this.container.append('div')
            .attr('id', 'legend_key');
        
        var legend_key_entries = this.key.selectAll('div')
            .data(legend.key_data)
            .enter().append('div')
            .attr('class', function(d) {
                return 'legend_key_entry legend_key_' + d.id;
            });
        
        legend_key_entries.append('div')
            .attr('class', 'legend_key_term')
            .html(function(d) { return d.term; });
        
        legend_key_entries.append('div')
            .attr('class', 'legend_key_label')
            .html(function(d) { return d.label; });                    
    },
    populate: function() {     
        // Show all series   
//        data.series.map(function(series) {
//            series.shown = true; 
//        });
        
        // Get series ids
        legend.series = data.series.map(function(series) {
            return series.id; 
        });
        
        legend.container.select('.legend_title')
            .text(options.series.getLabel());
        
        // Hide table entries
//        d3.select('#legend_key')
//            .style('display', (options.series.is('terms') ? 'table' : 'none'));
        
        // Add new entries
        var entries = legend.container_series
            .selectAll('div.legend_entry')
            .data(legend.series);

        var new_entries = entries.enter().append('div')
            .attr('id', function(d) {
                return 'legend_' + d;
            })
            .attr('class', function(d) {
                return 'legend_entry ' + d;
            })
            .on('mouseover', this.hoverLegendEntry)
            .on('mouseout', this.hoverLegendEntryEnd);

        var legend_icon_divs = new_entries.append('div')
            .attr('class', 'legend_icon');
        
        legend_icon_divs.append('span')
            .attr('class', 'glyphicon')
            .on('click', function() { return false; });
        
        legend_icon_divs.append('svg')
            .attr({
                class: "legend_icon_svg",
                width: 25, height: 25
            })
            .on('mousedown', this.startToggle)
            .on('mouseover', this.hoverOverSeries)
            .on('mouseup', this.endToggle)
            .append('rect')
            .attr({
                class: "legend_icon_rect",
                x: 2.5, y: 2.5,
                rx: 5, ry: 5,
                width: 20, height: 20
            });

        new_entries.append('div')
            .attr('class', 'legend_label');
        
        new_entries.append('div')
            .attr('class', 'legend_only')
            .text('only')
            .on('click', legend.toggleSingle);

        // Remove entries
        entries.exit().remove();
        
        // Propagate data to children
        entries.each(function(d) {
            var entry = d3.select(this);
            entry.select('div.legend_icon').data([d])
                .select('svg').select('rect');
            entry.select('div.legend_label').data([d]);
            entry.select('div.legend_only').data([d]);
        });

        entries
            .attr('id', function(d) {
                return 'legend_' + d;
            })
            .attr('class', function(d) {
                return 'legend_entry ' + d;
            });
        
        legend.container_series.on('mouseout', function(d) {
            d3.event.stopPropagation();
        });
        legend.container.on('mouseout', legend.endToggle);
        
        legend.key_data.map(function(item) {
            item.has = false;
        });

        legend.container.selectAll('div.legend_label')
            .html(function (d) {
                var series = data.series_byID[d];
            
                var name = series.name;
                if(options.series.is('terms')) {
                    if(series.isOldKeyword) {
                        name += ' &#x271d;';
                        legend.key_data[1].has = true; // removed
                    }else if(!series.isKeyword) {
                        name += ' *';
                        legend.key_data[2].has = true; // added
                    } else {
                        legend.key_data[0].has = true; // capture
                    }
                }
                return name;
            });
        
        legend.key_data.map(function(item) {
            this.key.select('.legend_key_' + item.id)
                .classed('hidden', !item.has);
        }, legend);
        
        legend.showOrHideAll();
    },
    cmp: function(a, b) {
        if(options.series_order.is('alpha')) {
            a = a.name.toLowerCase();
            b = b.name.toLowerCase();
            
            if(a < b)
                return -1;
            else if(a > b)
                return 1;
            return 0
            
        } else if(options.series_order.is('volume')) {
            a = a.sum;
            b = b.sum;

            if(a < b)
                return 1;
            else if(a > b)
                return -1;
            return 0
        } else if(options.series_order.is('type')) {
            if((a.isKeyword && !b.isKeyword) || (a.isOldKeyword && !b.isKeyword && !b.isOldKeyword))
                return -1;
            else if((!a.isKeyword && b.isKeyword) || (!a.isOldKeyword && !a.isKeyword && b.isOldKeyword))
                return 1;
            return b.sum - a.sum;
        } else {
            a = a.order;
            b = b.order;
            
            if(a < b)
                return -1;
            else if(a > b)
                return 1;
            return 0
        }
        
    },
    cmp_byID: function(a, b) {
        a = data.series_byID[a];
        b = data.series_byID[b];
        return legend.cmp(a, b);
    },
    startToggle: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        legend.mouseOverToggle = true;
        legend.mouseOverToggleState = !series.shown;
        legend.toggleSeries(series); 
        d3.event.stopPropagation();
    },
    endToggle: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        if(legend.mouseOverToggle) {
            legend.mouseOverToggle = false;
            data.prepareData(); 
        }
    },
    highlightSeries: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];

        d3.selectAll('.series, .legend_icon')
            .classed('focused', false)
            .classed('unfocused', true);
        d3.selectAll('.series.' + series.id + ', .' + series.id + ' .legend_icon')
            .classed('unfocused', false)
            .classed('focused', true);
    },
    hoverLegendEntry: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        legend.highlightSeries(series);
    },
    hoverLegendEntryEnd: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        legend.unHighlightSeries(series);
    },
    unHighlightSeries: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        d3.selectAll('.series, .legend_icon')
            .classed('focused', false)
            .classed('unfocused', false);
    },
    toggleSeries: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        series.shown = !series.shown;
        legend.showOrHideSeries(series);
        
        if(!legend.mouseOverToggle) {
            data.prepareData();
        }
    },
    showOrHideSeries: function(series) {
        d3.select('.' + series.id + ' .legend_icon')
            .classed('off', !series.shown);
        
        if(options.legend_showhidden.is("false") && !series.shown) {
            $('.legend_entry.' + series.id).fadeOut();
        } else {
            $('.legend_entry.' + series.id).fadeIn().css('display', 'table-row');
        }
    },
    showOrHideAll: function() {
        data.series.map(legend.showOrHideSeries);
    },
    toggleSingle: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        data.series.map(function(inner_series) {
            inner_series.shown = false;//!turnAllOff; 
        }, this);
        
        series.shown = true;
        
        legend.showOrHideAll();

        data.prepareData();
    },
    showAll: function() {
        
        data.series.map(function(inner_series) {
            inner_series.shown = true;
        }, this);
        
        legend.showOrHideAll();

        data.prepareData();
    },
    hoverOverSeries: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        window.getSelection().removeAllRanges()
        if(legend.mouseOverToggle && series.shown != legend.mouseOverToggleState) {
            legend.toggleSeries(series);
        }
    }
}