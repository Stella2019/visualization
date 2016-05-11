function TimeseriesLegend(app) {
    this.app = app;
    this.container = [];
    this.cursorHeldDown = false;
    this.cursorToggleTo = true;
    this.tooltip = app.tooltip;
    
    // Key Data
    this.key_data = [
        {term: "&nbsp;", label: "Capture Term", id: 'capture', has: false},
        {term: "&#x271d;", label: "Removed Capture Term", id: 'removed', has: false},
        {term: "*", label: "Term Added Later", id: 'added', has: false},
        {term: "R", label: "Rumor", id: 'rumor', has: false},
        {term: "<svg height=10 width=10><line x1=0 y1=10 x2=10 y2=0 class='total_line' /></svg>",
            label: "Tweet Volume", id: 'total_line', has: false}
    ];
    this.key_data_byID = this.key_data.reduce(function(all, cur) {
        all[cur.id] = cur;
        return all;
    }, {});
    this.key_data_byLabel = this.key_data.reduce(function(all, cur) {
        all[cur.label] = cur;
        return all;
    }, {});
    this.color = d3.scale.category10();
    
    this.init();
    
    this.features = {};
    this.features_arr = [];
    this.subsets = {};
    this.subsets_arr = [];
}
TimeseriesLegend.prototype = {
    init: function() {
        this.setTriggers();
    },
    setTriggers: function() {
        triggers.on('page_built', this.buildLegend.bind(this));
        triggers.on('subsets:updated', this.populateLegend.bind(this));
        triggers.on('legend:color scale', this.setColorScale.bind(this));
        triggers.on('legend:color', this.colorSeries.bind(this));
        triggers.on('legend:series', this.linkSeries.bind(this));
        
        
        triggers.on('series:highlight', this.highlightSeries.bind(this));
        triggers.on('series:unhighlight', this.unHighlightSeries.bind(this));
        
        triggers.on('series:chart click', this.chartClickGetTweets.bind(this));
        triggers.on('series:chart enter', this.chartHoverEnter.bind(this));
        triggers.on('series:chart hover', this.chartHoverMove.bind(this));
        triggers.on('series:chart exit', this.chartHoverEnd.bind(this));
        
        triggers.on('series:legend enter', this.hoverLegendEntry.bind(this));
        triggers.on('series:legend hover', this.hoverLegendEntryMove.bind(this));
        triggers.on('series:legend exit', this.hoverLegendEntryEnd.bind(this));
        
        triggers.on('legend:clean', this.showOrHideAll.bind(this));
        triggers.on('feature:legend visibility', this.showOrHideFeature.bind(this));
        triggers.on('series:legend visibility', this.showOrHideSeries.bind(this));
        
        triggers.on('series:icon down', this.startToggle.bind(this));
        triggers.on('series:icon over', this.hoverOverSeries.bind(this));
        triggers.on('series:icon up', this.endToggle.bind(this));
    },
    buildLegend: function() {
        this.container = d3.select('body').append('div')
            .attr('class', 'legend');
        
        triggers.emit('legend:color scale');
    },
    populateLegend: function() {
        // Destroy old legend
        this.container.selectAll('*').remove();
        
        // Get list of features & subsets from the collection
        this.features = {};
        this.features_arr = [];
        this.subsets = {};
        this.subsets_arr = [];
        
        // Iterate through subsets and add features
        this.app.collection.subsets_arr.forEach(function(subset) { 
            this.subsets[subset.ID] = subset;
            this.subsets_arr.push(subset);
            
            // Add (to) feature
            var feature = this.features[subset.Feature];
            if(feature) {
                feature.subsets.push(subset);
                subset.feature = feature;
            } else {
                feature = {
                    Label: subset.Feature,
                    subsets: [subset],
                }
                this.features[subset.Feature] = feature;
                this.features_arr.push(feature);
                subset.feature = feature;
            }
            // TODO make this respond to changes
            feature.color = d3.scale.category10()
                .domain(feature.subsets.map(d => d.ID));
        }, this);
        
        // Sort the features and their subsets
        this.features_arr.sort((A, B) => d3.ascending(A.Label, B.Label));
        
        // Add features to the sidemenu
        this.features_arr.forEach(function(feature) {
            feature.shown = false;
            feature.subsets.sort((A, B) =>
                                 A.Event > B.Event ?  1 :
                                 A.Event < B.Event ? -1 :
                                 A.Rumor > B.Rumor ?  1 :
                                 A.Rumor < B.Rumor ? -1 :
                                 A.DisplayMatch > B.DisplayMatch ?  1 :
                                 A.DisplayMatch < B.DisplayMatch ? -1 :
                                    0)
            
            feature.div = this.container.append('div');
            
            feature.div.append('h4')
                .html(feature.Label);
            
            feature.list_div = feature.div.append('div')
                .attr('class', 'legend_series_list feature_' + util.simplify(feature.Label));
            
            this.placeNewSeries(feature);
            
            var entries = feature.list_div
                .selectAll('div.legend_entry');
            
            // Propagate data to children
            entries.each(function(d) {
                var entry = d3.select(this);
                entry.select('div.legend_icon').data([d])
                    .select('svg').select('rect');
                entry.select('div.legend_label').data([d]);
                entry.select('div.legend_only').data([d]);
            });
            
            entries
                .attr('id', d => 'legend_' + d.ID)
                .attr('class', d => 'legend_entry subset_' + d.ID);
            
            feature.list_div.selectAll('div.legend_label')
                .html(d => d.DisplayMatchWithRumor);
            
            // Hide the feature until we get data for it
            triggers.emit('feature:legend visibility', feature);
//            list_div.on('mouseout', legend.endToggle);
        }, this);
    },
    placeNewSeries: function(feature) {
        var entries = this.container.select('.feature_' + util.simplify(feature.Label))
            .selectAll('div.legend_entry');
        
        var data_entries = entries
            .data(feature.subsets);
        
        var new_entries = data_entries
            .enter().append('div')
            .attr('id', d => 'legend_' + d.ID)
            .attr('class', d => 'legend_entry subset_' + d.ID)
            .on('mouseover', triggers.emitter('series:legend enter'))
            .on('mousemove', triggers.emitter('series:legend hover'))
            .on('mouseout', triggers.emitter('series:legend exit'));

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
            .on('mousedown', triggers.emitter('series:icon down'))
            .on('mouseover', triggers.emitter('series:icon over'))
            .on('mouseup', triggers.emitter('series:icon up'))
            .append('rect')
            .attr({
                class: "legend_icon_rect",
                x: 2.5, y: 2.5,
                rx: 5, ry: 5,
                width: 20, height: 20
            });

        new_entries.append('div')
            .attr('class', 'legend_label');

//            new_entries.append('div')
//                .attr('class', 'legend_only')
//                .text('only')
//                .on('click', this.toggleSingle);
        
        data_entries.exit().remove();
    },
    setColorScale: function() {
//        this.typeColor = d3.scale.category20c();
        this.typeColor = d3.scale.ordinal()
//            .range(["#AAA", "#CCC", "#999", "#BBB"]);
            .range(["#CCC"]);
        
        // Set global scale
        switch(this.app.ops['View']['Color Scale'].get()) {
            case "category10":
                this.color = d3.scale.category10();
                break;
            case "category20":
                this.color = d3.scale.category20();
                break;
            case "category20b":
                this.color = d3.scale.category20b();
                break;
            case "category20c":
                this.color = d3.scale.category20c();
                break;
            default:
                this.color = d3.scale.category10();
                break;
        }
        
        // Set per-feature scale TODO fix this to the last thing
        this.features_arr.forEach(function(feature) {
            feature.color = d3.scale.category10()
                .domain(feature.subsets.map(d => d.ID));
        }, this);
        
        triggers.emit('legend:color');
    },
    linkSeries: function(subset) {
        // TODO handle context series
        // TODO add to subsets list
        if(subset.chart == 'focus') {
//            console.log(this.subsets, subset);
            this.subsets[subset.ID].data = subset;
        }
        
        triggers.emit('legend:color', this.subsets[subset.ID]);
    },
    colorSeries: function(subset) {
        if(!subset) { // Then color them all =D
            this.subsets_arr.forEach(this.colorSeries.bind(this));
            return;
        }
        if(!('data' in subset)) {
            return;
        }
            
        // Determine primary color
        if(subset.data.chart == 'focus') {
            subset.color = subset.feature.color(subset.ID);
            subset.data.Label = subset.Label;
            subset.data.shown = this.app.ops['Series']['Shown'].get()
                .includes(parseInt(subset.ID));
            
            // Turn on/off the legend entry // TODO verify consequences
//            if(subset.data.shown) {
                subset.feature.shown = true;
                triggers.emit('feature:legend visibility', subset.feature);
//            } else {
//                triggers.emit('series:legend visibility', subset);
//            }
        } else { // Context
            subset.color = '#000'; // Black
            subset.data.shown = true;
        }
        
        // Determine fill & stroke color from that
        subset.data.fill = subset.color; //this.color(subset.ID);
        subset.data.stroke = d3.rgb(subset.data.fill).darker();
        
        // Color the legend icon
        this.container.select(".subset_" + subset.ID + " .legend_icon")
            .style('fill', subset.data.fill)
            .style('stroke', subset.data.stroke);
        
    },
    init_old: function() {
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
    populate_old: function(category) {
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
    cmp: function(A, B) {
//        var ordering = this.app.ops['Series']['Order'];
//        
//        if(ordering == 'alpha') {
//            var name1 = a.label || '';
//            var name2 = b.label || '';
//            name1 = name1.toLowerCase();
//            name2 = name2.toLowerCase();
//            
//            if(name1 < name2)
//                return -1;
//            else if(name1 > name2)
//                return 1;
//            return 0
//            
//        } else if(ordering == 'volume') {
//            a = a.sum;
//            b = b.sum;
//
//            if(a < b)
//                return 1;
//            else if(a > b)
//                return -1;
//            return 0
//        } else if(ordering == 'type') {
//            if((a.isKeyword && !b.isKeyword) || (a.isOldKeyword && !b.isKeyword && !b.isOldKeyword))
//                return -1;
//            else if((!a.isKeyword && b.isKeyword) || (!a.isOldKeyword && !a.isKeyword && b.isOldKeyword))
//                return 1;
//            return b.sum - a.sum;
//        } else {
//            a = a.order;
//            b = b.order;
//            
//            if(a < b)
//                return -1;
//            else if(a > b)
//                return 1;
//            return 0
//        }
        
        return A.Feature > B.Feature ?  1 :
            A.Feature < B.Feature ? -1 :
            A.Event > B.Event ?  1 :
            A.Event < B.Event ? -1 :
            A.Rumor > B.Rumor ?  1 :
            A.Rumor < B.Rumor ? -1 :
            A.DisplayMatch > B.DisplayMatch ?  1 :
            A.DisplayMatch < B.DisplayMatch ? -1 :
            0;
    },
    cmp_byID: function(a, b) {
        a = data.series[a];
        b = data.series[b];
        return legend.cmp(a, b);
    },
    startToggle: function(series) {
        this.cursorHeldDown = true;
        this.cursorToggleTo = !series.data.shown;
        this.toggleSeries(series); 
        d3.event.stopPropagation();
    },
    endToggle: function(series) {
        if(typeof(series) == "string")
            series = data.series[series];
        
        if(this.cursorHeldDown) {
            this.cursorHeldDown = false;
            triggers.emit('timeseries:stack')// TODO
//            pipeline.start('Find Which Data is Shown');
        }
    },
    highlightSeries: function(series) {
        d3.selectAll('.series, .legend_icon')
            .classed('focused', false)
            .classed('unfocused', true);
        d3.selectAll('.series.subset_' + series.ID + ', .subset_' + series.ID + ' .legend_icon')
            .classed('unfocused', false)
            .classed('focused', true);
    },
    unHighlightSeries: function() {
        d3.selectAll('.series, .legend_icon')
            .classed('focused', false)
            .classed('unfocused', false);
    },
    hoverLegendEntry: function(series) {
        // Generate tooltip
        var info = {
            ID: series.ID,
            'Total Tweets': util.formatThousands(series.Tweets),
        }
        if(series.data) {
            info['Total Shown'] = util.formatThousands(series.data.sum);
            info['Max'] = util.formatThousands(series.data.max);
        }
        
        this.tooltip.setData(info);
        this.tooltip.on();
        
        triggers.emit('series:highlight', series);
    },
    hoverLegendEntryMove: function(series) {
        this.tooltip.move(d3.event.x, d3.event.y);
    },
    hoverLegendEntryEnd: function(series) {
        this.tooltip.off();
        triggers.emit('series:unhighlight');
    },
    chartClickGetTweets: function(series) {
        // Get parent objects
        var chart = this.app[series.chart];
        var time_obj = this.app.model.time;
        
        // Get position
        var time = chart.x.invert(series.cursor_xy[0]);
        time.setSeconds(0);
        var resolution = this.app.ops['View']['Resolution'].get();
        var i_r = ['minute', 'tenminute', 'hour', 'day'].indexOf(resolution);
        var i_t = time_obj.stamp_index[util.formatDate(time)];
        var value_i = time_obj.indices[i_t][i_r];
        var time_min = time_obj[resolution + 's'][value_i];
        var time_max = time_obj[resolution + 's'][value_i + 1];
        
        triggers.emit('fetch tweets', {
            collection: series.chart == 'context' ? 'event' : 'subset',
            event_id: this.app.collection.event.ID,
            subset_id: series.ID,
            time_min: time_min,
            time_max: time_max,
            label: series.Label,
        });
    },
    chartHoverEnter: function(series) {
        this.tooltip.on();
        
        triggers.emit('series:highlight', series);
    },
    chartHoverMove: function(series) {
        this.tooltip.move(d3.event.x, d3.event.y);
//        triggers.emit('tooltip:move', [d3.event.x, d3.event.y]);
        
        // Get parent objects
        var chart = this.app[series.chart];
        var time_obj = this.app.model.time;
        
        // Get position
        var time = chart.x.invert(series.cursor_xy[0]);
        time.setSeconds(0);
        var resolution = this.app.ops['View']['Resolution'].get();
        var i_r = ['minute', 'tenminute', 'hour', 'day'].indexOf(resolution);
        var i_t = time_obj.stamp_index[util.formatDate(time)];
        var value_i = time_obj.indices[i_t][i_r];
        var time_min = time_obj[resolution + 's'][value_i];
        var time_max = time_obj[resolution + 's'][value_i + 1];

        // Fetch column
        var focus_column = chart.column_highlight;
        var old_data = focus_column.data();

        // Get data values
        var value = series.values[value_i].value;
        var value0 = series.values[value_i].value0;
        
        // Set tooltip data
        this.tooltip.setData({
            series: series.Label,
            from: util.formatDate(time_min),
            to: util.formatDate(time_max),
            tweets: util.formatThousands(value),
            ' ': '<i>Click to get tweets</i>'
        });
        
        if(!old_data || old_data.series != series.Label ||
           util.compareDates(old_data.startTime, time_min) ||
           util.compareDates(old_data.stopTime,  time_max) ) {

            focus_column.data([{
                series: series.Label,
                startTime: time_min,
                stopTime: time_max,
                value: value,
                value0: value0
            }]);

            focus_column
                .transition()
                .duration(50)
                .attr("d", 
                    chart.area([
                        {timestamp: time_min, value: value, value0: value0},
                        {timestamp: time_max, value: value, value0: value0}
                    ]))
                .style('display', 'block');
        }

        if(!old_data || old_data.series != series.id)
            trigger.emit('series:highlight', series);
    },
    chartHoverEnd: function(series) {
        this.app[series.chart].column_highlight.style('display', 'none');
        
        this.tooltip.off();
        triggers.emit('series:unhighlight');
    },
    toggleSeries: function(series) {
        series.data.shown = !series.data.shown;
        var visible = this.app.ops['Series']['Shown'].get();
        if(series.data.shown) {
            visible = util.lunion(visible, [series.data.ID])
        } else {
            visible = util.ldiff(visible, [series.data.ID])
        }
        this.app.ops['Series']['Shown'].set(visible);
        triggers.emit('series:legend visibility', series);
        
        if(!this.cursorHeldDown) {
            this.app.ops.recordState();
            // TODO
//            pipeline.start('Find Which Data is Shown');
        }
    },
    showOrHideSeries: function(series) {
        d3.select('.subset_' + series.ID + ' .legend_icon')
            .classed('off', series.data && !series.data.shown);
        
        if(!series.data || (this.app.ops['Series']['Clean Legend'].is("true") && !series.data.shown)) {
            this.fadeOut('.legend_entry.subset_' + series.ID);
        } else {
            this.fadeIn('.legend_entry.subset_' + series.ID, 'table-row');
        }
    },
    showOrHideFeature: function(feature) { // TODO fix
        feature.subsets.forEach(triggers.emitter('series:legend visibility'));
        
        // See if any of it's children are active
        var children_shown = d3.max(feature.subsets, subset => subset.data && subset.data.shown);
        
        if(this.app.ops['Series']['Clean Legend'].is("true") && !children_shown) {
            this.fadeOut(feature.div);
        } else if(!feature.shown) {
            this.fadeOut(feature.list_div);
        } else {
            this.fadeIn(feature.div, 'block');
            this.fadeIn(feature.list_div, 'block');
        }
    },
    showOrHideAll: function(feature) {
        if(feature) {
            this.showOrHideFeature(feature);
        } else {
            this.features_arr.forEach(this.showOrHideFeature, this);
        }
    },
    toggleSingle: function(series) { // TODO fix or discard
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
    showAll: function(category) { // TODO fix or discard
        
        category.series_plotted.forEach(function(series) {
            series.shown = true;
        }, this);
        
        legend.showOrHideAll(category);

        pipeline.start('Find Which Data is Shown');
    },
    hoverOverSeries: function(series) {
        window.getSelection().removeAllRanges()
        if(this.cursorHeldDown && series.data.shown != this.cursorToggleTo) {
            series.data.shown = this.cursorToggleTo;
            
            var visible = this.app.ops['Series']['Shown'].get();
            if(series.data.shown) {
                visible = util.lunion(visible, [series.data.ID])
            } else {
                visible = util.ldiff(visible, [series.data.ID])
            }
            this.app.ops['Series']['Shown'].set(visible);
            
            this.app.ops.recordState();
            triggers.emit('series:legend visibility', series);
        }
    },
    configureFilters: function() { // TODO fix or discard
        data.cats_arr.forEach(function(category) {
            // Toggle on if it is the display chart
            if(options['Series']['Chart Category'].is(category.name)) {
                category.filter = true;
            }
            
            // Style
            legend.filterStyle(category);
        });
    },
    filterToggle: function(category) { // TODO fix or discard
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
            
            triggers.emit('series:legend visibility', series);
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
    },
    fadeIn: function(d3_object, display) {
        if(typeof(d3_object) == "string")
            d3_object = d3.select(d3_object);
        d3_object.transition()
            .style('opacity', 1)
            .style('display', display || 'table');
    },
    fadeOut: function(d3_object) {
        if(typeof(d3_object) == "string")
            d3_object = d3.select(d3_object);
        d3_object.transition()
            .style('opacity', 0)
            .each('end', function() {
                d3.select(this).style('display', 'none')
            });
    },
}