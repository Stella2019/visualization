function Legend() {
    var self = this;
    self.container = [];
    self.mouseOverToggle = false;
    self.mouseOverToggleState = true;
    
    // Key Data
    self.key_data = [
        {term: "&nbsp;", label: "Capture Term", id: 'capture', has: false},
        {term: "&#x271d;", label: "Removed Capture Term", id: 'removed', has: false},
        {term: "*", label: "Term Added Later", id: 'added', has: false},
        {term: "R", label: "Rumor", id: 'rumor', has: false},
        {term: "<svg height=10 width=10><line x1=0 y1=10 x2=10 y2=0 class='total_line' /></svg>",
            label: "Tweet Volume", id: 'total_line', has: false}
    ];
    self.key_data_byID = self.key_data.reduce(function(all, cur) {
        all[cur.id] = cur;
        return all;
    }, {});
    self.key_data_byLabel = self.key_data.reduce(function(all, cur) {
        all[cur.label] = cur;
        return all;
    }, {});
}
Legend.prototype = {
    init: function() {
        this.container = d3.select('#legend')
            .on('mouseout', this.endToggle);
        
        data.cats_arr.forEach(this.buildLegendSection, this);
    },
    buildLegendSection: function(category) {
        var container = this.container.append('div')
            .attr('class', 'legend_section ' + category.id);
        
        // Header
        var legend_header = container.append('div')
            .data([category])
            .attr('class', 'legend_header');
        
        legend_header.append('div')
            .attr('class', 'legend_filter_div')
            .append('button')
            .attr('class', 'btn btn-xs btn-default')
            .html('<span class="glyphicon glyphicon-ban-circle"></span> Filter')
            .on('click', this.filterToggle);
        category.filter = false;
        
        legend_header.append('span')
            .attr('class', 'legend_title')
            .text(category.name)

        legend_header.append('div')
            .attr('class', 'legend_showall')
            .text('show all')
            .on('click', this.showAll);
        
        // Series
        var list = container.append('div')
            .attr('class', 'legend_series_list');
        
        if(category.name == 'Keyword') {
            legend.container_keywords = list;
            
            // Key
            this.key = container.append('div')
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
        }
    },
    populate: function(category) {
        var section_div = legend.container.select('.' + category.id);
        var list_div = section_div.select('.legend_series_list');
        
        // Get series ids
        var ids = category.series_plotted.map(function(d) {
            return d.id;
        });
        
        // Add new entries
        var entries = list_div
            .selectAll('div.legend_entry')
            .data(ids);

        var new_entries = entries.enter().append('div')
            .attr('id', function(d) {
                return 'legend_' + d;
            })
            .attr('class', function(d) {
                return 'legend_entry ' + d;
            })
            .on('mouseover', legend.hoverLegendEntry)
            .on('mousemove', legend.hoverLegendEntryMove)
            .on('mouseout', legend.hoverLegendEntryEnd);

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
            .on('mousedown', legend.startToggle)
            .on('mouseover', legend.hoverOverSeries)
            .on('mouseup', legend.endToggle)
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
        
//        list_div.on('mouseout', function(d) {
//            d3.event.stopPropagation();
//        });
//        legend.container.on('mouseout', legend.endToggle);
        list_div.on('mouseout', legend.endToggle);
        
        if(category.name == 'Keyword') {
            legend.key_data.forEach(function(item) {
                item.has = false;
            });

            list_div.selectAll('div.legend_label')
                .html(function (d) {
                    var series = data.series[d];
                    var name = series.display_name;
                    var key_data = legend.key_data_byLabel[series.type];

                    if(key_data) {
                        name += ' ' + key_data.term;
                        key_data.has = true;
                    }
                    return name;
                });

            legend.key_data.forEach(function(item) {
                this.key.select('.legend_key_' + item.id)
                    .classed('hidden', !item.has);
            }, legend);
        } else {
            list_div.selectAll('div.legend_label')
                .html(function (d) {
                    var series = data.series[d];
                    var name = series.display_name;
                    return name;
                });
        }
        
        legend.showOrHideAll(category);
    },
    cmp: function(a, b) {
        if(options['Series']['Order'].is('alpha')) {
            var name1 = a.display_name || a.name || '';
            var name2 = b.display_name || b.name || '';
            name1 = name1.toLowerCase();
            name2 = name2.toLowerCase();
            
            if(name1 < name2)
                return -1;
            else if(name1 > name2)
                return 1;
            return 0
            
        } else if(options['Series']['Order'].is('volume')) {
            a = a.sum;
            b = b.sum;

            if(a < b)
                return 1;
            else if(a > b)
                return -1;
            return 0
        } else if(options['Series']['Order'].is('type')) {
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
        a = data.series[a];
        b = data.series[b];
        return legend.cmp(a, b);
    },
    startToggle: function(series) {
        if(typeof(series) == "string")
            series = data.series[series];
        
        legend.mouseOverToggle = true;
        legend.mouseOverToggleState = !series.shown;
        legend.toggleSeries(series); 
        d3.event.stopPropagation();
    },
    endToggle: function(series) {
        if(typeof(series) == "string")
            series = data.series[series];
        
        if(legend.mouseOverToggle) {
            legend.mouseOverToggle = false;
            pipeline.start('Find Which Data is Shown');
        }
    },
    highlightSeries: function(series) {
        if(typeof(series) == "string")
            series = data.series[series];

        d3.selectAll('.series, .legend_icon')
            .classed('focused', false)
            .classed('unfocused', true);
        d3.selectAll('.series.' + series.id + ', .' + series.id + ' .legend_icon')
            .classed('unfocused', false)
            .classed('focused', true);
    },
    hoverLegendEntry: function(series) {
        if(typeof(series) == "string")
            series = data.series[series];
        
        // Generate tooltip
        disp.tooltip.setData({
            total: series.total,
            max: series.max,
            type: series.type
        });
        disp.tooltip.on();
        
        legend.highlightSeries(series);
    },
    hoverLegendEntryMove: function(series) {
        disp.tooltip.move(d3.event.x, d3.event.y);
    },
    hoverLegendEntryEnd: function(series) {
        if(typeof(series) == "string")
            series = data.series[series];
        
        disp.tooltip.off();
        
        legend.unHighlightSeries(series);
    },
    chartClickGetTweets: function(series) {
        var time = disp.getTimeHoveringOverAxis(this);

        data.getTweets({
            series: series,
            time_min: time.min,
            time_max: time.max
        });
    },
    chartHoverEnter: function(series) {
        disp.tooltip.on();
        
        legend.highlightSeries(series);
    },
    chartHoverMove: function(series) {
        disp.tooltip.move(d3.event.x, d3.event.y);
        
        var time = disp.getTimeHoveringOverAxis(this);

        var focus_column = disp.focus.svg.select('path.column_hover');
        var old_data = focus_column.data();

//      var value_i = Math.floor(xy[0] / focus.width * d.values.length);
        var value_i = data.time.stamps_nested_int.indexOf(time.min.getTime()) + 1;
        var value = series.values[value_i].value;
        var value0 = series.values[value_i].value0;
        
        disp.tooltip.setData({
            series: series.display_name,
            from: util.formatDate(time.min),
            to: util.formatDate(time.max),
            tweets: value,
            ' ': '<i>Click to get tweets</i>'
        });

        if(!old_data || old_data.series != series.id ||
           util.compareDates(old_data.startTime, time.min) ||
           util.compareDates(old_data.stopTime,  time.max) ) {

            focus_column.data([{
                series: series.id,
                startTime: time.min,
                stopTime: time.max,
                value: value,
                value0: value0
            }]);

            focus_column
                .transition()
                .duration(50)
                .attr("d", 
                    disp.focus.area([
                        {timestamp: time.min, value: value, value0: value0},
                        {timestamp: time.max, value: value, value0: value0}
                    ]))
                .style('display', 'block');
        }

        if(!old_data || old_data.series != series.id)
            legend.highlightSeries(series);
    },
    chartHoverEnd: function(series) {
        if(typeof(series) == "string")
            series = data.series[series];
        
        disp.focus.svg.select('path.column_hover')
            .style('display', 'none');
        
        disp.tooltip.off();

        legend.unHighlightSeries(series)
    },
    unHighlightSeries: function(series) {
        if(typeof(series) == "string")
            series = data.series[series];
        
        d3.selectAll('.series, .legend_icon')
            .classed('focused', false)
            .classed('unfocused', false);
    },
    toggleSeries: function(series) {
        if(typeof(series) == "string")
            series = data.series[series];
        
        series.shown = !series.shown;
        legend.showOrHideSeries(series);
        
        if(!legend.mouseOverToggle) {
            pipeline.start('Find Which Data is Shown');
        }
    },
    showOrHideSeries: function(series) {
        d3.select('.' + series.id + ' .legend_icon')
            .classed('off', !series.shown);
        
        if(options['Series']['Clean Legend'].is("true") && !series.shown) {
            disp.fadeOut('.legend_entry.' + series.id);
        } else {
            disp.fadeIn('.legend_entry.' + series.id, 'table-row');
        }
    },
    showOrHideCategory: function(category) {
        category.series_plotted
                .forEach(legend.showOrHideSeries);
        
        if(options['Series']['Clean Legend'].is("true") && !category.filter) {
            disp.fadeOut('.legend_section.' + category.id);
        } else {
            disp.fadeIn('.legend_section.' + category.id, 'block');
        }
    },
    showOrHideAll: function(category) {
        if(category) {
            legend.showOrHideCategory(category);
        } else {
            data.cats_arr.forEach(legend.showOrHideCategory);
        }
    },
    toggleSingle: function(series) {
        if(typeof(series) == "string")
            series = data.series[series];
        
        var category = data.cats[series.category];
        category.series_plotted
            .forEach(function(inner_series) {
            inner_series.shown = false;//!turnAllOff; 
        }, this);
        
        series.shown = true;
        
        legend.showOrHideAll(category);

        pipeline.start('Find Which Data is Shown');
    },
    showAll: function(category) {
        
        category.series_plotted.forEach(function(series) {
            series.shown = true;
        }, this);
        
        legend.showOrHideAll(category);

        pipeline.start('Find Which Data is Shown');
    },
    hoverOverSeries: function(series) {
        if(typeof(series) == "string")
            series = data.series[series];
        
        window.getSelection().removeAllRanges()
        if(legend.mouseOverToggle && series.shown != legend.mouseOverToggleState) {
            legend.toggleSeries(series);
        }
    },
    configureFilters: function() {
        data.cats_arr.forEach(function(category) {
            // Toggle on if it is the display chart
            if(options['Series']['Chart Category'].is(category.name)) {
                category.filter = true;
            }
            
            // Style
            legend.filterStyle(category);
        });
    },
    filterToggle: function(category) {
        var on = !category.filter;
        category.filter = on;
        
        legend.filterStyle(category);
        
        category.series_arr.forEach(function(series) {
            if(series.isAggregate) {
                series.shown = !on;
            } else if (['Tweet Type', 'Distinctiveness']
                       .includes(category.name)) {
                series.shown = true;
            } else {
                series.shown = on;
            }
            
            legend.showOrHideSeries(series);
        });
        
        // Render any changes
        pipeline.start('Find Which Data is Shown');
        
    },
    filterStyle: function(category) {
        var section = d3.select('.' + category.id);
        var div = section.select('.legend_filter_div button');
        var list = section.select('.legend_series_list')
        if (category.filter) {
            div.attr('class', 'btn btn-xs btn-primary')
                .attr('disabled', null)
                .html('<span class="glyphicon glyphicon-filter"></span> Filter');
            
            list.transition()
                .style('opacity', 1)
                .style('display', 'table')
        } else {
            div.attr('class', 'btn btn-xs btn-default')
                .attr('disabled', null)
                .html('<span class="glyphicon glyphicon-ban-circle"></span> Filter');
            
            list.transition()
                .style('opacity', 0)
                .each('end', function() {
                    d3.select(this).style('display', 'none')
                });
        }
        
        if(options['Series']['Chart Category'].is(category.name)) {
            div.attr('disabled', true)
                .html('In Chart');
        }
    }
}