var FD;

function FeatureDistribution() {
    this.connection = new Connection();
    this.ops = new Options(this);
    this.modal = new Modal(this);
    this.tooltip = new Tooltip();
    this.dataset = new CollectionManager(this, {
        name: 'Dataset', 
        flag_subset_menu: true,
        flag_secondary_event: true,
        flag_time_window: false,
        flag_allow_edits: false
    });
    
    this.data = {};
    
    this.hierarchy = {
        'Tweet Based': {
            'Categories':   ['Type', 'Distinct'],
            'Whole Text':   ['Text', 'Text Stripped'],
            'Text N-Grams': ['Unigrams', 'Bigrams', 'Trigrams', 'Co-Occur'],
            'Text Other':   ['Language', 'User Language', 'Using Pipe'],
            'URLs':         ['Expanded URL Domain', 'Expanded URL', 'Media URL'],
            'Origin':       ['Screenname / User ID', 'Parent Tweet', 'Source'],
            'Temporal':     ['Time Posted (PT)', 'User\'s Timezone'],
            'Mentions':     ['Users Retweeted', 'Users Replied', 'Users Quoted', 'Users Otherwise Mentioned', 'Parent Verified'],
        },
        'User Based': {
            'Activity':     ['Tweets', 'Tweets Per Day', 'Median Interval Between Tweets', 'Deviation Interval Between Tweets', 'Normal Deviation Interval Between Tweets'],
            'Identity':     ['Username', 'Description Unigrams', 'Lang', 'Verified'],
            'Temporal':     ['Account Creation Date', 'Age of Account'],
            'Localization': ['Location', 'UTC Offset', 'Timezone'],
            'Tweet Text':   ['Words', 'Distinct Words', 'Words Per Tweet', 'Distinct Words Per Tweet', 'Using Pipe'],
            'URLs':         ['Domains', 'URLs', 'URLs Per Tweet', 'Distinct Domains', 'Distinct Domains Per URL'],
            'Statuses':     ['Start', 'Growth', 'Growth &ne; 0'],
            'Followers':    ['Start', 'Growth', 'Growth &ne; 0'],
            'Following':    ['Start', 'Growth', 'Growth &ne; 0'],
            'Listed':       ['Start', 'Growth', 'Growth &ne; 0'],
            'Favorites':    ['Start', 'Growth', 'Growth &ne; 0'],
        }
    };
    this.hierarchy_major = {
        'Tweet Based': {
            'Categories':   ['Type', 'Distinct'],
            'Text N-Grams': ['Unigrams', 'Bigrams'],
            'URLs':         ['Expanded URL Domain'],
            'Origin':       ['Screenname / User ID'],
            'Mentions':     ['Users Retweeted'], // + Users Mentioned?
        },
        'User Based': {
            'Identity':     ['Description Unigrams', 'Verified'],
            'Localization': ['Location', 'Timezone'],
        }
    };
    this.hierarchy_flatted = [];
    Object.keys(this.hierarchy).forEach(function(level1) {
        var counters1 = this.hierarchy[level1];
        Object.keys(counters1).forEach(function(level2) {
            var counters2 = counters1[level2];
            counters2.forEach(function(counter) {
                this.hierarchy_flatted.push(level1 + '__' + level2 + '__' + counter);
            }, this);
        }, this);
    }, this);
    
    this.screenname2ID = {};
    
    // Page Objects
    this.body = [];
}
FeatureDistribution.prototype = {
    init: function() {
        this.setTriggers();
        this.buildPage();
        this.setOptions();
        this.buildLoadButtons();
        
        this.tooltip.init();
        triggers.emit('modal:build');
        triggers.emit('collectionManager:build');
        
        setTimeout(triggers.emitter('tweets:fetch'), 1000);
    },
    setTriggers: function() {
        
        triggers.on('event:updated', this.toggleLoadButtons.bind(this, 'Event'));
        triggers.on('subset:updated', this.toggleLoadButtons.bind(this, 'Subset'));
        
        triggers.on('event2:updated', this.toggleLoadButtons.bind(this, 'Event2'));
        triggers.on('subset2:updated', this.toggleLoadButtons.bind(this, 'Subset2'));
        
        triggers.on('counters:count', this.countFeatures.bind(this));
        triggers.on('counters:place', this.placeCounts.bind(this));
        triggers.on('counters:show', this.showCounts.bind(this));
        triggers.on('counters:visibility', this.toggleCounterVisibility.bind(this));
    },
    buildPage: function() {
        this.body = d3.select('body').append('div')
            .attr('id', 'body');
        
        // Navbar
        this.navbar = this.body.append('nav') 
            .attr('class', 'navbar navbar-default navbar-fixed-top')
            .append('div')
            .attr('class', 'container-fluid');
        
        var navbar_header = this.navbar.append('div')
            .attr('class', 'navbar-header');
        
        var collapse_button = navbar_header.append('button')
            .attr({
                type: 'button',
                class: 'navbar-toggle collapsed',
                'data-toggle': 'collapse',
                'data-target': '#navbar',
                'aria-expanded': false
            });
        
        collapse_button.append('span').attr('class', 'sr-only').html('Toggle Navigation');
        collapse_button.append('span').attr('class', 'icon-bar');
        collapse_button.append('span').attr('class', 'icon-bar');
        collapse_button.append('span').attr('class', 'icon-bar');
        
        navbar_header.append('a')
            .attr('class', 'navbar-brand')
            .html('Features');
        
        var navbar_bases = this.navbar.append('div')
            .attr('id', 'navbar')
//            .attr('class', 'collapse nav-collapse')
            .append('ul')
            .attr('class', 'nav navbar-nav')
            .selectAll('li')
            .data(Object.keys(this.hierarchy))
            .enter()
            .append('li')
            .attr('class', 'dropdown');
        
        navbar_bases.append('a')
            .attr({
                class: 'dropdown-toggle',
                'data-toggle': 'dropdown',
                role: 'button',
                'aria-haspopup': true,
                'aria-expanded': false,
            })
            .html(function(d) { return d + '<span class="caret"></span>'; });
        
        navbar_bases.append('ul')
            .attr('class', 'dropdown-menu')
            .selectAll('li')
            .data(function(basis) { 
                return Object.keys(this.hierarchy[basis]).map(function(feat_type) { 
                    return {feat_type: feat_type, basis: basis};
                }); 
            }.bind(this))
            .enter()
            .append('li')
            .append('a')
            .html(function(d) { return d.feat_type; })
            .on('click', function(d) {
                // Scroll page to table
                var target = $('div.feat_type-' + util.simplify(d.basis + '__' + d.feat_type));
                if (target.length)
                {
                    var top = target.offset().top;
                    $('html,body').animate({scrollTop: top - 60}, 1000);
                    return false;
                }
            });
        
        // Description Box
        var description_box = this.body.append('div')
            .attr('class', 'descriptions');
        
        this.desc_a = description_box.append('div')
            .attr('class', 'description');
        this.desc_b = description_box.append('div')
            .attr('class', 'description');
        
        // Tables
        this.basis_divs = this.body.selectAll('div.basis')
            .data(Object.keys(this.hierarchy))
            .enter()
            .append('div')
            .attr('class', function(d) { 
                return 'basis basis-' + util.simplify(d); 
            });
        
        this.basis_divs.append('h2')
            .html(function(d) { return d; });
        
        this.feat_type_divs = this.basis_divs.selectAll('div.feat_type')
            .data(function(d) {
                return Object.keys(this.hierarchy[d]).map(function(e) { return d + '__' + e; }); 
            }.bind(this))
            .enter()
            .append('div')
            .attr('class', function(d) {
                
//                navbar_list.append('li')
//                    .append('a')
//                    .append('small')
//                    .html(d);
                
                return 'feat_type feat_type-' + util.simplify(d); 
            });
        
        this.feat_type_divs.append('h3')
            .html(function(d) { return d.split('__')[1]; });
        
        this.feature_divs = this.feat_type_divs.selectAll('div.feature')
            .data(function(de) {
                de = de.split('__');
                var d = de[0]; var e = de[1];
                return this.hierarchy[d][e].map(function(f) { return d + '__' + e + '__' + f; }); 
            }.bind(this))
            .enter()
            .append('div')
            .attr('class', function(d) { return 'feature feature-' + util.simplify(d); });
        
        this.feature_divs.append('h4')
            .html(function(d) {
                return d.split('__')[2];
            });
        
        this.feature_divs.append('p');
        this.feature_divs.append('table')
            .attr('class', function(d) { return 'table-' + util.simplify(d); })
            .append('thead');
        this.feature_divs.select('table').append('tbody');
    },
    setOptions: function() {
        this.ops.panels = ['Dataset', 'Download', 'Display'];
        
        this.ops['Dataset'] = {};
        this.ops['Download'] = {
            Limit: new Option({
                title: 'Tweet Limit',
                labels: ['100', '1 000', '10 000', '100 000', '1 000 000', '10 000 000', 'All'],
                ids: [1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e10],
                isnumeric: true
            }),
            'Chunk Size': new Option({
                title: 'Tweets per Chunk',
                labels: ['10', '100', '1 000', '5 000'],
                ids:    [ 1e1,   1e2,     1e3,     5e3],
                default: 1,
                isnumeric: true
            }),
            'Extra Data': new Option({
                title: 'Extra Data',
                labels: ['None', 'User', 'Parent Tweet', 'User & Parent'],
                ids: ['', 'u', 'p', 'up'],
                default: 1,
                isnumeric: true
            }),
            'Upload Limit': new Option({
                title: 'Upload Limit / User',
                labels: ['10', '100', 'All'],
                ids:    [ 1e1,   1e2,   1e5],
                default: 1,
                render: false,
                isnumeric: true
            })
        };
        this.ops['Display'] = {
            'Show Major': new Option({
                title: "Show Tables",
                labels: ['only Major', 'All'],
                ids:    ['only Major', 'All'],
                type: 'toggle',
                tooltip: 'Toggle to show all tables or JUST the major ones for feature analysis',
                callback: triggers.emitter('counters:visibility')
            }),
            TopX: new Option({
                title: "Top",
                labels: ['1', '5', '10', '20', '100', '200', '1000'],
                ids:    ['1', '5', '10', '20', '100', '200', '1000'],
                default: 3,
                callback: triggers.emitter('counters:place')
            }),
            Filter: new Option({
                title: "Filter",
                labels: ['None', 'Redundant Tweets'],
                ids:    ['none', 'redun'],
                default: 0,
                callback: triggers.emitter('counters:count')
            }),
            'Exclude Stopwords': new Option({
                title: "Stopwords",
                styles: ["btn btn-sm btn-default", "btn btn-sm"],
                labels: ["Include",
                         "Exclude"],
                ids:    ['false', 'true'],
                default: 1,
                type: 'toggle',
                callback: triggers.emitter('counters:place')
            }),
            'Count Quantity': new Option({
                title: 'Count Quantity',
                labels: ['Frequency', 'Percent'],
                ids: ['Frequency', 'Percent'],
                callback: triggers.emitter('counters:place')
            }),
            'Cmp Quantity': new Option({
                title: 'Cmp Quantity',
                labels: ['Difference', 'Ratio', 'Log Ratio'],
                ids: ['Difference', 'Ratio', 'Log Ratio'],
                default: 2,
                callback: triggers.emitter('counters:show')
            }),
            'Order': new Option({
                title: 'Order by',
                labels: ['Token Alphabetical', 'Frequency A', 'Frequency B', 'Frequency Combined', 'Comparison', 'Comparison Magnitude'],
                ids: ['Token', 'Frequency', 'Frequency B', 'Frequency Combined', 'Comparison', 'Comparison Magnitude'],
                default: 1,
                callback: triggers.emitter('counters:place')
            }),
            'Ascending': new Option({
                title: 'Order Direction',
                labels: ['Ascending', 'Descending'],
                ids: ['asc', 'desc'],
                default: 1,
                callback: triggers.emitter('counters:place')
            }),
        };
        
        // Populate the dataset options with the collection manager
        triggers.emit('collectionManager:setOptions');
        
        // Initialize the sidebar
        this.ops.init();
    },
    buildLoadButtons: function() {
        // Change names in the dataset selector
        this.ops.sidebar.select('#choose_lDataset_lEvent .option-label')
            .html('Event A');
        this.ops.sidebar.select('#choose_lDataset_lSubset .option-label')
            .html('Subset A');
        
        // Add download buttons
        this.download_box = this.ops.sidebar.select('#panel_lDownload');
        
        var load_buttons = this.download_box.append('div')
            .attr('class', 'load-button-div')
            .selectAll('div.load-button-set-div')
            .data(['', ''])
            .enter()
            .append('div')
            .attr('class', function(d, i) {
                return 'load-button-set-' + String.fromCharCode(65 + i);
            });
        
        load_buttons.append('span')
            .html(function(d, i) { return String.fromCharCode(65 + i) + ': '; });
        
        load_buttons.append('button')
            .attr('class', 'btn btn-xs load-start')
            .html('Load')
            .on('click', this.loadTweets.bind(this));
        
        load_buttons.append('button')
            .attr('class', 'btn btn-xs load-stop')
            .html('Stop')
            .on('click', this.abortLoadTweets.bind(this));
        
        load_buttons.append('button')
            .attr('class', 'btn btn-xs load-clear')
            .html('Clear')
            .on('click', this.clearTweets.bind(this));
        
        load_buttons.append('br');
        load_buttons.append('small')
            .html('Upload ');
        
        load_buttons.append('button')
            .attr('class', 'btn btn-xs upload-users')
            .html('Users')
            .on('click', this.uploadAllUserStats.bind(this));
        
        load_buttons.append('button')
            .attr('class', 'btn btn-xs upload-mentions')
            .html('Mentions')
            .on('click', this.userMentionsUpload.bind(this));
        
        load_buttons.append('button')
            .attr('class', 'btn btn-xs upload-sources')
            .html('Sources')
            .on('click', this.userSourceUpload.bind(this));
//        load_buttons.append('button')
//            .attr('class', 'btn btn-xs upload-lexicon')
//            .html('Lexicon')
//            .on('click', this.userLexiconUpload.bind(this));
//        load_buttons.append('button')
//            .attr('class', 'btn btn-xs upload-lexical-relations')
//            .html('Lexical Rel')
//            .on('click', this.userLexicalRelationUpload.bind(this));
    },
    toggleLoadButtons: function(collection) {
        if(!collection) {
            this.toggleLoadButtons('Subset');
            this.toggleLoadButtons('Subset2');
            return;
        }
        
        // Get name of set
        var cmp = collection.includes('2');
        var collection_type = cmp ? collection.slice(0, -1) : collection;
        var collection_id = this.dataset[collection.toLowerCase()] ? this.dataset[collection.toLowerCase()].ID : undefined;
        var setname = collection_type + ' ' + collection_id;
        if(!collection_id && collection_type == 'Subset') { // elevate to event set
            collection_type = 'Event';
            collection = collection_type + (cmp ? '2' : '');
            collection_id = this.dataset[collection.toLowerCase()] ? this.dataset[collection.toLowerCase()].ID : undefined;
            setname = collection_type + ' ' + collection_id;
        }
        if (!collection_id) {
            setname = '';
        }
        var has_dataset = setname in this.data && this.data[setname].tweets_arr.length > 1;
        
        // Set the buttons to react to that name
        var button_box = this.download_box.select('.load-button-set-' + (cmp ? 'B' : 'A'))
            .data([setname]);
        button_box.select('.load-start')
            .classed('btn-default', setname ? true : false);
        button_box.select('.load-stop')
            .classed('btn-default', setname ? true : false);
        button_box.select('.load-clear')
            .classed('btn-default', setname ? true : false);
        button_box.select('.upload-users')
            .classed('btn-default', has_dataset ? true : false);
        button_box.select('.upload-mentions')
            .classed('btn-default', has_dataset ? true : false);
        button_box.select('.upload-sources')
            .classed('btn-default', has_dataset ? true : false);
        button_box.select('.upload-lexicon')
            .classed('btn-default', has_dataset ? true : false);
        button_box.select('.upload-lexical-relations')
            .classed('btn-default', has_dataset ? true : false);
    },
    loadTweets: function(setname) {
        var args = setname.split(' ');
        if(args.length < 2) {
            triggers.emit('alert', 'Unable to load set: ' + setname);
            return;
        }
        var collection_type = args[0];
        var collection_id = args[1];
        var extradata = this.ops['Download']['Extra Data'].get();
        
        // Initialize the data storage
        var data = {};
        var lastTweet = 0;
        if(!(setname in this.data)) {
            data = {
                collection: collection_type,
                id: collection_id,
                tweets: {},
                tweets_arr: [],
                users: {},
                counted: 0
            };
            if(collection_type == 'Subset') {
                data.SubsetEntry = this.dataset['subsets'][data.id] || this.dataset['subsets2'][data.id];
                data.EventEntry = this.dataset['events'][data.SubsetEntry.Event];
                data.label = (data.EventEntry.DisplayName || data.EventEntry.Name) + ' - ' + data.SubsetEntry.Feature + ' - ' + util.subsetName(data.SubsetEntry);
                data.FirstTweet = data.SubsetEntry['FirstTweet'];
            } else {
                data.EventEntry = this.dataset['events'][data.id];
                data.label = data.EventEntry.DisplayName || data.EventEntry.Name;
                data.FirstTweet = data.EventEntry['FirstTweet'];
            }
            this.data[setname] = data;
        } else {
            // Start where we left off
            data = this.data[setname];
            lastTweet = data.tweets_arr[data.tweets_arr.length - 1];
            if(typeof(lastTweet) == 'object')
                lastTweet = lastTweet.ID;
            lastTweet = new BigNumber(lastTweet);
        }
        
        // Find the max amount of tweets
        var limit = this.ops['Download']['Limit'].get();
        if(limit == 1e10) {
            if(data.subset) {
                limit = parseInt(data.SubsetEntry.Tweets);
            } else {
                limit = parseInt(data.EventEntry.Tweets);
            }
        }
        
        // Initialize the connection
        data.tweet_connection = new Connection({
            url: 'tweets/get',
            post: {
                collection: collection_type,
                collection_id: collection_id,
                extradata: extradata,
                json: true,
            },
            quantity: 'count',
            resolution: this.ops['Download']['Chunk Size'].get(),
            max: limit,
            on_chunk_finish: this.parseNewTweets.bind(this, setname),
            on_finish: this.toggleLoadButtons.bind(this, false),
            progress_text: '{cur}/{max} Loaded',
        });
        if(lastTweet) { // If we are continuing from when we left off
            data.tweet_connection['lastTweet'] = lastTweet;
        }
        
        // Start the connection
        data.tweet_connection.startStream();
    },
    abortLoadTweets: function(setname) {
        this.data[setname].tweet_connection.stop();
        this.data[setname].tweet_connection.progress.end();
    },
    clearTweets: function(setname) {
        this.abortLoadTweets(setname);
        delete this.data[setname];
    },
    parseNewTweets: function(setname, newTweets) {        
        // End early if no more data
        if(newTweets.length == 0) {
            this.abortLoadTweets(setname);
        }
    
        $.merge(this.data[setname].tweets_arr, newTweets);
        // Add information to the tweets
//        newTweets.forEach(function(tweet) {
//            if(!(tweet.ID in this.data[setname].tweets)) {
//                this.data[setname].tweets[tweet.ID] = tweet;
//                this.data[setname].tweets_arr.push(tweet);
//            }
//        }, this);
        
        triggers.emit('counters:count', setname);
    },
    countFeatures: function(setname) {
        var set = this.data[setname];
        if(!set) return;
        
        var processAllFeatures = this.ops['Display']['Show Major'].is('All');
        
        // Remake counting attributes if they haven't been counted yet
        if(!set.counted || set.counted == set.tweets_arr.length) {
            set.counted = 0;
            set.nTweets = 0;
            set.nUsers = 0;

            // Start Counters        
            set.counter = {};
            this.hierarchy_flatted.forEach(function(counter) {
                set.counter[counter] = new Counter();
            });
            
        }
        
        // Count features of the tweets & their users
        for(; set.counted < set.tweets_arr.length; set.counted++) {
            var tweet = set.tweets_arr[set.counted];
            
            if(!tweet || typeof(tweet) != 'object') {
                this.abortLoadTweets(setname);
                continue;
            }
            
            this.countTweet(set, tweet);
            this.countUser(set, tweet);
        }
        
        // Purge rare quantities from counters that take a LOT of memory
        if(set.counted > 1e6) {
            // Increased
            set.counter['Tweet Based__Text N-Grams__Co-Occur'].purgeBelow(10);
            set.counter['Tweet Based__Text N-Grams__Bigrams'].purgeBelow(5);
            if(processAllFeatures)
                set.counter['Tweet Based__Text N-Grams__Trigrams'].purgeBelow(5);
        } else {
            set.counter['Tweet Based__Text N-Grams__Co-Occur'].purgeBelow(5);
            set.counter['Tweet Based__Text N-Grams__Bigrams'].purgeBelow(2);
            if(processAllFeatures)
                set.counter['Tweet Based__Text N-Grams__Trigrams'].purgeBelow(2);
            
//            set.counter['UserDescription Unigrams'].purgeBelow(2);
        }
        
        triggers.emit('counters:place', setname);
    },
    countTweet: function(set, tweet) {
        var processAllFeatures = this.ops['Display']['Show Major'].is('All');
        var repeatTextOK = this.ops['Display']['Filter'].is('none');
        var newTweetText = !set.counter['Tweet Based__Whole Text__Text Stripped'].has(tweet.TextStripped);

        if(repeatTextOK || newTweetText) { // Aggressive redundancy check
            set.nTweets += 1;

            // Add new features
            var domain = tweet['ExpandedURL'];
            if(domain) {
                domain = util.URL2Domain(domain);
            }
            tweet['Expanded URL Domain'] = domain;

            // Get time feature
            var time = tweet['Timestamp'];
            time = util.date(time);
            time.setSeconds(0);
            time.setMilliseconds(0);
            time = time.getTime();
            tweet['Timestamp Minute'] = time;

            // Count Major features
            set.counter['Tweet Based__Categories__Type'].incr(tweet['Type']);
            set.counter['Tweet Based__Categories__Distinct'].incr(tweet['Distinct']);
            if(tweet['Expanded URL Domain']) {
                set.counter['Tweet Based__URLs__Expanded URL Domain'].incr(tweet['Expanded URL Domain']);
            } else {
                set.counter['Tweet Based__URLs__Expanded URL Domain'].not_applicable++;
            }
            set.counter['Tweet Based__Origin__Screenname / User ID'].incr(tweet['Screenname'] + ' - ' + tweet['UserID']);
            
            // Count other features
            if (processAllFeatures) {
                set.counter['Tweet Based__Whole Text__Text'].incr(tweet['Text']);
                set.counter['Tweet Based__Whole Text__Text Stripped'].incr(tweet['TextStripped']);
                
                set.counter['Tweet Based__Text Other__Language'].incr(util.subsetName({feature: 'Lang', match: (tweet['Lang'] || '').toLowerCase()}));
                set.counter['Tweet Based__Text Other__User Language'].incr(util.subsetName({feature: 'Lang', match: (tweet['UserLang'] || '').toLowerCase()}));
                set.counter['Tweet Based__Text Other__Using Pipe'].incr(tweet['Text'].includes('|') ? 1 : 0);
                
                set.counter['Tweet Based__URLs__Expanded URL'].incr(tweet['ExpandedURL']);
                set.counter['Tweet Based__URLs__Media URL'].incr(tweet['MediaURL']);
                set.counter['Tweet Based__Origin__Parent Tweet'].incr(tweet['ParentID']);
                set.counter['Tweet Based__Origin__Source'].incr(tweet['Source']);
                set.counter['Tweet Based__Temporal__Time Posted (PT)'].incr(tweet['Timestamp Minute']);
                set.counter['Tweet Based__Temporal__User\'s Timezone'].incr(tweet['UserTimezone']);
            }

            // Count N-Grams
            var text = tweet.TextStripped.toLowerCase();
            text = text.replace(/[^\w']+/g, ' ');
            text = text.replace(/(\w)' /g, '$1 ').replace(/ '(\w)/g, ' $1');
            var words = text.split(' ').filter(function(word) { return word.length > 0; });
            var tweetgrams = [new Set(), new Set(), new Set(), new Set()];

            words.forEach(function(word, wi) {
                if(word) {
                    var gram = word;
                    set.counter['Tweet Based__Text N-Grams__Unigrams'].incr(gram);
                    if(!tweetgrams[0].has(gram)) {
                        tweetgrams[0].add(gram);
//                            ngrams.NGramHasCounter[0].incr(gram);
                    }
                    if(words[wi + 1]) {
                        gram += " " + words[wi + 1];
                        set.counter['Tweet Based__Text N-Grams__Bigrams'].incr(gram);
                        if(!tweetgrams[1].has(gram)) {
                            tweetgrams[1].add(gram);
//                                ngrams.NGramHasCounter[1].incr(gram);
                        }
                        if(words[wi + 2] && processAllFeatures) {
                            gram += " " + words[wi + 2];
                            set.counter['Tweet Based__Text N-Grams__Trigrams'].incr(gram);
                            if(!tweetgrams[2].has(gram)) {
                                tweetgrams[2].add(gram);
//                                    ngrams.NGramHasCounter[2].incr(gram);
                            }
                        }
                    }
                    if(processAllFeatures) {
                        for(var wj = wi + 1; wj < words.length; wj++) { 
                            gram = word + ' & ' + words[wj];
                            if(words[wj] < word)
                                gram = words[wj] + ' & ' + word;
                            // Add co-occurance
                            if(words[wj]) {
                                set.counter['Tweet Based__Text N-Grams__Co-Occur'].incr(gram);
                                if(!tweetgrams[3].has(gram)) {
                                    tweetgrams[3].add(gram);
    //                                    ngrams.CoOccurHasCounter.incr(gram);
                                }
                            }
                        }
                    }
                }
            });
            
            // Parent Tweet & User Mentions
            if(processAllFeatures) {
                var parentVerified = tweet['ParentVerified'];
                if(parentVerified == undefined) {
                    set.counter['Tweet Based__Mentions__Parent Verified'].not_applicable++;
                } else {
                    set.counter['Tweet Based__Mentions__Parent Verified'].incr(parentVerified);
                }
            }
            
            // User Mentions
            if(tweet['Text']) {
                var direct_mentions = new Set();
                
                if('ParentScreenname' in tweet) {
                    set.counter['Tweet Based__Mentions__Users Retweeted'].not_applicable++;
                    set.counter['Tweet Based__Mentions__Users Replied'].not_applicable++;
                    set.counter['Tweet Based__Mentions__Users Quoted'].not_applicable++;
                    
                    if(tweet['ParentScreenname']) {
                        this.screenname2ID[tweet['ParentScreenname'].toLowerCase()] = tweet['ParentUserID'];
                        
                        direct_mentions.add((tweet['ParentScreenname'] || '').toLowerCase());
                        if(tweet['Type'] == 'retweet') {
                            set.counter['Tweet Based__Mentions__Users Retweeted'].incr(tweet['ParentScreenname']);
                            set.counter['Tweet Based__Mentions__Users Retweeted'].not_applicable--;
                        } else if(tweet['Type'] == 'reply') {
                            set.counter['Tweet Based__Mentions__Users Replied'].incr(tweet['ParentScreenname']);
                            set.counter['Tweet Based__Mentions__Users Replied'].not_applicable--;
                        } else if(tweet['Type'] == 'quote') {
                            set.counter['Tweet Based__Mentions__Users Quoted'].incr(tweet['ParentScreenname']);
                            set.counter['Tweet Based__Mentions__Users Quoted'].not_applicable--;
                        } else {
                            console.log('Original tweet with a parent screenname, what?' + tweet['ParentScreenname'] + ' ' + tweet['Text']);
                        }
                    }
                } else {
                    // Retweets
                    var rts = tweet['Text'].match(/^RT @[A-Za-z_0-9]*/gi);
                    if(rts) {
                        rts.forEach(function(mention) {
                            direct_mentions.add(mention.slice(4).toLowerCase());
                            set.counter['Tweet Based__Mentions__Users Retweeted'].incr(mention.slice(4));
                        });
                    } else {
                        set.counter['Tweet Based__Mentions__Users Retweeted'].not_applicable++;
                    }

                    // Replies
                    var res = tweet['Text'].match(/^@[A-Za-z_0-9]*/gi);
                    if(res) {
                        res.forEach(function(mention) {
                            direct_mentions.add(mention.slice(1).toLowerCase());
                            set.counter['Tweet Based__Mentions__Users Replied'].incr(mention.slice(1));
                        });
                    } else {
                        set.counter['Tweet Based__Mentions__Users Replied'].not_applicable++;
                    }
                }

                // Otherwise mentions
                var mentions = (tweet['Text'].match(/@[A-Za-z_0-9]*/gi) || []).map(m => m.slice(1).toLowerCase());
                mentions = mentions.filter(m => !direct_mentions.has(m));
                if(mentions && mentions.length > 0) {
                    mentions.forEach(function(mention) {
                        set.counter['Tweet Based__Mentions__Users Otherwise Mentioned'].incr(mention);
                    });
                } else {
                    set.counter['Tweet Based__Mentions__Users Otherwise Mentioned'].not_applicable++;
                }
            }
        } // New Tweet or New URL

        // Remove the tweet object to save memory, will prevent other analysis but necessary for large datasets
//            set.tweets_arr[set.counted] = tweet.ID; // TODO
    },
    countUser: function(set, tweet) {
        if(!tweet['UserID']) {
            return;
        }
        var processAllFeatures = this.ops['Display']['Show Major'].is('All');
        
        this.screenname2ID[tweet['Screenname'].toLowerCase()] = tweet['UserID'];
        var userscreenid = tweet['Screenname'] + ' - ' + tweet['UserID'];
        var newUser = set.counter['Tweet Based__Origin__Screenname / User ID'].get(userscreenid) == 1;
        var user = {};

        if(newUser) {
            set.nUsers += 1;

            var creation = util.date(tweet['UserCreatedAt'] || util.formatDate(new Date()));
            creation.setMilliseconds(0);
            creation.setSeconds(0);
            creation.setMinutes(0);
            creation.setHours(0);
            var firstTweet = util.twitterID2Timestamp(set.EventEntry.FirstTweet);
            var age = Math.floor((firstTweet.getTime() - creation.getTime()) / 24 / 60 / 60 / 1000);

            // Get user's description's unigrams
            var desc = (tweet.UserDescription || '').toLowerCase();
            desc = desc.replace(/[^\w']+/g, ' ');
            desc = desc.replace(/(\w)' /g, '$1 ').replace(/ '(\w)/g, ' $1');
            var desc_words = util.lunique(desc.split(' ').filter(function(word) { return word.length > 0; }));
            if(desc_words.length == 0) {
                desc_words = [tweet.UserDescription];
            }

            // Count user's tweet's unigrams
            var tweet_words = new Counter();
            var text = tweet.TextStripped.toLowerCase();
            text = text.replace(/[^\w']+/g, ' ');
            text = text.replace(/(\w)' /g, '$1 ').replace(/ '(\w)/g, ' $1');
            var words = text.split(' ').filter(function(word) { return word.length > 0; });
            words.forEach(function(word) {
                tweet_words.incr(word);
            });
            
            // Get the user's domain
            var hasURL = 0;
            var domain = tweet['ExpandedURL'];
            if(domain) {
                hasURL = 1;
                domain = util.URL2Domain(domain);
            }

            user = {
                Tweets: 1,

                UserID: tweet['UserID'],
                Screenname: tweet['Screenname'],
                Username: tweet['Username'],
                Location: tweet['UserLocation'],
                UTCOffset: tweet['UserUTCOffset'],
                Timezone: tweet['UserTimezone'],
                Lang: tweet['UserLang'],
                Verified: tweet['UserVerified'],

                Description: tweet['UserDescription'],
                DescriptionWords: desc_words,

                TweetWords: tweet_words,
                Words: tweet_words.total_count,
                DistinctWords: tweet_words.tokens,
                WordsPerTweet: tweet_words.total_count,
                DistinctWordsPerTweet: tweet_words.tokens,
                UsingPipe: tweet['Text'].includes('|') ? 1 : 0,
                
                URLs: hasURL,
                URLsPerTweet: hasURL,
                DistinctDomains: hasURL,
                DistinctDomainsPerURL: hasURL,
                Domains: new Counter(),
                Sources: new Counter(),

                CreatedAt: creation,
                Age: age,

                FirstTweet: tweet['ID'],
                LastTweet: tweet['ID'],

                MinutesInSet: 0,
                TweetsPerDay: 1,
                MinuteStarted: (util.twitterID2Timestamp(tweet['ID']).getTime() - util.twitterID2Timestamp(set.FirstTweet).getTime()) / 60 / 1000,
                MinuteEnded: (util.twitterID2Timestamp(tweet['ID']).getTime() - util.twitterID2Timestamp(set.FirstTweet).getTime()) / 60 / 1000,

                'UsersMentioned': new Counter(),
                'UsersRetweeted': new Counter(),
                'UsersReplied': new Counter(),
                'UsersQuoted': new Counter(),
                'UsersSimplyMentioned': new Counter(),
                Mentions: 0,
                SimpleMentions: 0,
                'MentionsOfUser': 0, // These features are gotten by doing the mention script
                'RetweetsOfUser': 0,
                'RepliesOfUser': 0,
                'QuotesOfUser': 0,
                'SimpleMentionsOfUser': 0,
                
                TweetInterval: {
                    All: [],
                    Min: 0, Max: 0,
                    Med: 0, Ave: 0, 
                    Dev: 0, NormDev: 0,
                },
                Statuses: { Start:parseInt(tweet['UserStatusesCount']), 
                           End:parseInt(tweet['UserStatusesCount']), Growth: 0, PerDay: 0},
                Followers: { Start:parseInt(tweet['UserFollowersCount']), 
                           End:parseInt(tweet['UserFollowersCount']), Growth: 0, PerDay: 0},
                Following: { Start:parseInt(tweet['UserFriendsCount']), 
                           End:parseInt(tweet['UserFriendsCount']), Growth: 0, PerDay: 0},
                Listed: { Start:parseInt(tweet['UserListedCount']), 
                           End:parseInt(tweet['UserListedCount']), Growth: 0, PerDay: 0},
                Favorites: { Start:parseInt(tweet['UserFavouritesCount']), 
                           End:parseInt(tweet['UserFavouritesCount']), Growth: 0, PerDay: 0},

                Distinct: {Count: tweet['Distinct'] == '1' ? 1 : 0, Fraction: tweet['Distinct'] == '1' ? 1 : 0},
                Originals: {Count: 0, Fraction: 0},
                Retweets: {Count: 0, Fraction: 0},
                Replies: {Count: 0, Fraction: 0},
                Quotes: {Count: 0, Fraction: 0},
            };
            ['Originals', 'Retweets', 'Replies', 'Quotes'].forEach(function(type) {
                if(tweet['Type'].includes(type.slice(0,4).toLowerCase())) {
                    user[type]['Count'] = 1;
                    user[type]['Fraction'] = 1;
                }
            });

            set.users[user.UserID] = user;

            // Major features
            // User Description Unigrams
            desc_words.forEach(function(word) {
                set.counter['User Based__Identity__Description Unigrams'].incr(word);
            });
            set.counter['User Based__Identity__Verified'].incr(user['Verified']);
            set.counter['User Based__Localization__Location'].incr(user['Location']);
            set.counter['User Based__Localization__Timezone'].incr(user['Timezone']);
            
            // Other features
            if(processAllFeatures) {
                set.counter['User Based__Identity__Username'].incr(user['Username']);
                set.counter['User Based__Identity__Lang'].incr(util.subsetName({feature: 'Lang', match: (user['Lang'] || '').toLowerCase()}));
                set.counter['User Based__Activity__Tweets'].incr(user['Tweets']);
                set.counter['User Based__Activity__Tweets Per Day'].incr(user['TweetsPerDay']);
                set.counter['User Based__Activity__Median Interval Between Tweets'].not_applicable++;
                set.counter['User Based__Activity__Deviation Interval Between Tweets'].not_applicable++;
                set.counter['User Based__Activity__Normal Deviation Interval Between Tweets'].not_applicable++;
    //                set.counter['User Based__Activity__Median Interval Between Tweets'].incr(user['MedianTweetInterval']);
                set.counter['User Based__Temporal__Account Creation Date'].incr(creation.getTime());
                set.counter['User Based__Temporal__Age of Account'].incr(age);
                set.counter['User Based__Localization__UTC Offset'].incr(user['UTCOffset']);
                set.counter['User Based__Tweet Text__Words'].incr(user['Words']);
                set.counter['User Based__Tweet Text__Words Per Tweet'].incr(user['WordsPerTweet']);
                set.counter['User Based__Tweet Text__Distinct Words'].incr(user['DistinctWords']);
                set.counter['User Based__Tweet Text__Distinct Words Per Tweet'].incr(user['DistinctWordsPerTweet']);
                set.counter['User Based__Tweet Text__Using Pipe'].incr(user['UsingPipe']);


                // Counts
                ['Statuses', 'Followers', 'Following', 'Listed', 'Favorites'].forEach(function(feature) {
                    set.counter['User Based__' + feature + '__Start'].incr(user[feature]['Start']);
                    set.counter['User Based__' + feature + '__Growth'].incr(user[feature]['Growth']);
                    set.counter['User Based__' + feature + '__Growth &ne; 0'].not_applicable++;
                });

                // URLs
                if(user['URLs'] == 0) {
                    set.counter['User Based__URLs__URLs'].not_applicable++;
                    set.counter['User Based__URLs__URLs Per Tweet'].not_applicable++;
                    set.counter['User Based__URLs__Distinct Domains'].not_applicable++;
                    set.counter['User Based__URLs__Distinct Domains Per URL'].not_applicable++;
                } else {
                    user['Domains'].incr(domain);
                    set.counter['User Based__URLs__Domains'].incr(domain);
                    set.counter['User Based__URLs__URLs'].incr(user['URLs']);
                    set.counter['User Based__URLs__URLs Per Tweet'].incr(user['URLsPerTweet']);
                    set.counter['User Based__URLs__Distinct Domains'].incr(user['DistinctDomains']);
                    set.counter['User Based__URLs__Distinct Domains Per URL'].incr(user['DistinctDomainsPerURL']);
                }
                user['Sources'].incr(tweet['Source'].replace(/.*>(.*)<.*/, '$1'));
            }
        } else { // Old user
            user = set.users[tweet.UserID];

            // Other features (all major have already been accounted for)
            if(processAllFeatures) {

                // Tweets
                set.counter['User Based__Activity__Tweets'].decr(user['Tweets']);
                user['Tweets']++;
                set.counter['User Based__Activity__Tweets'].incr(user['Tweets']);

                // Major metrics
                set.counter['User Based__Activity__Tweets Per Day'].decr(user['TweetsPerDay']);
                user['MinuteEnded'] = (util.twitterID2Timestamp(tweet['ID']).getTime() - util.twitterID2Timestamp(set.FirstTweet).getTime()) / 60 / 1000;
                user['MinutesInSet'] = user['MinuteEnded'] - user['MinuteStarted'];
                user['TweetsPerDay'] = user['Tweets'] / Math.floor(user['MinutesInSet'] / 60 / 24 + 1);
                set.counter['User Based__Activity__Tweets Per Day'].incr(user['TweetsPerDay']);

                // Count user's tweet's unigrams
                var text = tweet.TextStripped.toLowerCase();
                text = text.replace(/[^\w']+/g, ' ');
                text = text.replace(/(\w)' /g, '$1 ').replace(/ '(\w)/g, ' $1');
                var words = text.split(' ').filter(function(word) { return word.length > 0; });
                words.forEach(function(word) {
                    user['TweetWords'].incr(word);
                });

                set.counter['User Based__Tweet Text__Words'].decr(user['Words']);
                set.counter['User Based__Tweet Text__Words Per Tweet'].decr(user['WordsPerTweet']);
                set.counter['User Based__Tweet Text__Distinct Words'].decr(user['DistinctWords']);
                set.counter['User Based__Tweet Text__Distinct Words Per Tweet'].decr(user['DistinctWordsPerTweet']);
                user['Words'] = user['TweetWords'].total_count
                user['WordsPerTweet'] = user['TweetWords'].total_count / user['Tweets'];
                user['DistinctWords'] = user['TweetWords'].tokens
                user['DistinctWordsPerTweet'] = user['TweetWords'].tokens / user['Tweets'];
                set.counter['User Based__Tweet Text__Words'].incr(user['Words']);
                set.counter['User Based__Tweet Text__Words Per Tweet'].incr(user['WordsPerTweet']);
                set.counter['User Based__Tweet Text__Distinct Words'].incr(user['DistinctWords']);
                set.counter['User Based__Tweet Text__Distinct Words Per Tweet'].incr(user['DistinctWordsPerTweet']);

                // Median Interval between tweets
                var thisTimeTweeted = util.twitterID2Timestamp(tweet['ID']).getTime();
                var interval = (thisTimeTweeted -
                                util.twitterID2Timestamp(user['LastTweet']).getTime())
                                / 60 / 1000;
                user['LastTweet'] = tweet['ID'];
                user['TweetInterval']['All'].push(interval);
                if(user['Tweets'] > 3) {
                    set.counter['User Based__Activity__Median Interval Between Tweets'].decr(user['TweetInterval']['Med']);
                    set.counter['User Based__Activity__Deviation Interval Between Tweets'].decr(user['TweetInterval']['Dev']);
                    set.counter['User Based__Activity__Normal Deviation Interval Between Tweets'].decr(user['TweetInterval']['NormDev']);
                } else if(user['Tweets'] == 3) {
                    set.counter['User Based__Activity__Median Interval Between Tweets'].decr(user['TweetInterval']['Med']);
                    set.counter['User Based__Activity__Deviation Interval Between Tweets'].not_applicable--;
                    set.counter['User Based__Activity__Normal Deviation Interval Between Tweets'].not_applicable--;
                } else if(user['Tweets'] == 2) {
                    set.counter['User Based__Activity__Median Interval Between Tweets'].not_applicable--;
                }
                user['TweetInterval']['Min'] = d3.min(user['TweetInterval']['All']);
                user['TweetInterval']['Max'] = d3.max(user['TweetInterval']['All']);
                user['TweetInterval']['Med'] = d3.median(user['TweetInterval']['All']);
                user['TweetInterval']['Ave'] = d3.mean(user['TweetInterval']['All']);
                set.counter['User Based__Activity__Median Interval Between Tweets'].incr(user['TweetInterval']['Med']);
                if(user['Tweets'] >= 3) {
                    user['TweetInterval']['Dev'] = d3.deviation(user['TweetInterval']['All']);
                    user['TweetInterval']['NormDev'] = user['TweetInterval']['Dev'] * 1.0 / user['TweetInterval']['Ave'];
                    set.counter['User Based__Activity__Deviation Interval Between Tweets'].incr(user['TweetInterval']['Dev']);
                    set.counter['User Based__Activity__Normal Deviation Interval Between Tweets'].incr(user['TweetInterval']['NormDev']);
                }

                // Using Pipe
                set.counter['User Based__Tweet Text__Using Pipe'].incr(user['UsingPipe'], -1);
                user['UsingPipe'] = (user['UsingPipe'] * (user['Tweets'] - 1) + tweet['Text'].includes('|') ? 1 : 0) / user['Tweets'];
                set.counter['User Based__Tweet Text__Using Pipe'].incr(user['UsingPipe'], 1);

                /* Counts */

                // Uncount the user's previous entry
                ['Statuses', 'Followers', 'Following', 'Listed', 'Favorites'].forEach(function(feature) {
                    set.counter['User Based__' + feature + '__Growth'].incr(user[feature]['Growth'], -1);
                    if(user[feature]['Growth'] == 0) {
                        set.counter['User Based__' + feature + '__Growth &ne; 0'].not_applicable--;
                    } else {
                        set.counter['User Based__' + feature + '__Growth &ne; 0'].incr(user[feature]['Growth'], -1);
                    }
                });

                // Get their new values
                user['Statuses']['End']  = parseInt(tweet['UserStatusesCount']);
                user['Followers']['End'] = parseInt(tweet['UserFollowersCount']);
                user['Following']['End'] = parseInt(tweet['UserFriendsCount']);
                user['Listed']['End']    = parseInt(tweet['UserListedCount']);
                user['Favorites']['End'] = parseInt(tweet['UserFavouritesCount']);
                ['Originals', 'Retweets', 'Replies', 'Quotes'].forEach(function(type) {
                    if(tweet['Type'].includes(type.slice(0,4).toLowerCase())) {
                        user[type]['Count']++;
                    }
                    user[type]['Fraction'] = user[type]['Count'] / user['Tweets'];
                });
                user['Distinct']['Count'] += tweet['Distinct'] == '1' ? 1 : 0;
                user['Distinct']['Fraction'] = user['Distinct']['Count'] / user['Tweets'];

                // Social feature counts
                ['Statuses', 'Followers', 'Following', 'Listed', 'Favorites'].forEach(function(feature) {
                    user[feature]['Growth'] = user[feature]['End'] - user[feature]['Start'];
                    user[feature]['PerDay'] = user[feature]['Growth'] * 24 * 60 / user['MinutesInSet'];

                    set.counter['User Based__' + feature + '__Growth'].incr(user[feature]['Growth'], 1);

                    if(user[feature]['Growth'] == 0) {
                        set.counter['User Based__' + feature + '__Growth &ne; 0'].not_applicable++;
                    } else {
                        set.counter['User Based__' + feature + '__Growth &ne; 0'].incr(user[feature]['Growth'], 1);
                    }
                });

                // URLs
                var domain = tweet['ExpandedURL'];
                if(domain) {
                    if(user['URLs'] == 0) {
                        set.counter['User Based__URLs__URLs'].not_applicable--;
                        set.counter['User Based__URLs__URLs Per Tweet'].not_applicable--;
                        set.counter['User Based__URLs__Distinct Domains'].not_applicable--;
                        set.counter['User Based__URLs__Distinct Domains Per URL'].not_applicable--;
                    } else {
                        set.counter['User Based__URLs__URLs'].decr(user['URLs']);
                        set.counter['User Based__URLs__URLs Per Tweet'].decr(user['URLsPerTweet']);
                        set.counter['User Based__URLs__Distinct Domains'].decr(user['DistinctDomains']);
                        set.counter['User Based__URLs__Distinct Domains Per URL'].decr(user['DistinctDomainsPerURL']);
                    }

                    domain = util.URL2Domain(domain);
                    var hasDomain = user['Domains'].has(domain);
                    user['Domains'].incr(domain);
                    if(user['Domains'].get(domain) == 1) {
                        set.counter['User Based__URLs__Domains'].incr(domain);
                    }

                    user['URLs']++;
                    user['URLsPerTweet'] = user['URLs'] / user['Tweets'];
                    user['DistinctDomains'] = user['Domains'].tokens;
                    user['DistinctDomainsPerURL'] = user['DistinctDomains'] / user['URLs'];

                    set.counter['User Based__URLs__URLs'].incr(user['URLs']);
                    set.counter['User Based__URLs__URLs Per Tweet'].incr(user['URLsPerTweet']);
                    set.counter['User Based__URLs__Distinct Domains'].incr(user['DistinctDomains']);
                    set.counter['User Based__URLs__Distinct Domains Per URL'].incr(user['DistinctDomainsPerURL']);
                }
                user['Sources'].incr(tweet['Source'].replace(/.*>(.*)<.*/, '$1'));
            }
        }

        // Users mentioned
        if(tweet['Text']) {
            var direct_mentions = new Set();
            if('ParentScreenname' in tweet) {
                if(tweet['ParentScreenname']) {
                    direct_mentions.add((tweet['ParentScreenname'] || '').toLowerCase());
                    if(tweet['Type'] == 'retweet') {
                        user['UsersRetweeted'].incr(tweet['ParentScreenname']);
                    } else if(tweet['Type'] == 'reply') {
                        user['UsersReplied'].incr(tweet['ParentScreenname']);
                    } else if(tweet['Type'] == 'quote') {
                        user['UsersQuoted'].incr(tweet['ParentScreenname']);
                    }
                }
            } else {
                // Retweets
                var rts = tweet['Text'].match(/^RT @[A-Za-z_0-9]*/gi) || [];
                if(rts) {
                    rts.forEach(function(mention) {
                        direct_mentions.add(mention.slice(4).toLowerCase());
                        user['UsersRetweeted'].incr(mention.slice(4));
                    });
                }

                // Replies
                var res = tweet['Text'].match(/^@[A-Za-z_0-9]*/gi) || [];
                if(res) {
                    res.forEach(function(mention) {
                        direct_mentions.add(mention.slice(1).toLowerCase());
                        user['UsersReplied'].incr(mention.slice(1));
                    });
                }
            }

            var mentions = (tweet['Text'].match(/@[A-Za-z_0-9]*/gi) || []).map(m => m.slice(1).toLowerCase());
            if(mentions) {
                mentions.forEach(function(mention) {
                    user['UsersMentioned'].incr(mention);
                });
            }
            var simple_mentions = mentions.filter(m => !direct_mentions.has(m));
            if(simple_mentions) {
                simple_mentions.forEach(function(mention) {
                    user['UsersSimplyMentioned'].incr(mention);
                });
            }

            // Add counters to user
            user['Mentions'] += mentions.length;
            user['SimpleMentions'] += simple_mentions.length;
        }
    },
    featureIsQuantitative: function(feature) {
        return feature.includes('Age of Account') ||
            feature.includes('Start') ||
            feature.includes('Growth') ||
            feature.includes('Activity') ||
            feature.includes('Words') ||
            (feature.includes('User Based__URLs') && !feature.includes('__Domains')) ||
            (feature.includes('User Based') && feature.includes('Using Pipe'));
    },
    placeCounts: function() {
        // Get appropriate set names
        var setname = this.dataset.subset ? 'Subset ' + this.dataset.subset.ID : 
                                            'Event '  + this.dataset.event.ID;
        var comparesetname = this.dataset.subset2 ? 'Subset '  + this.dataset.subset2.ID :
                             this.dataset.event2  ? 'Event '   + this.dataset.event2.ID : '';
        
        // Get set and comparison set
        var set = this.data[setname];
        this.desc_a.selectAll('*').remove();
        this.desc_a.append('h3')
            .html('Set A: ' + set.label);
        this.desc_a.append('h4')
            .html(set.collection + ' ' + set.id);
        this.desc_a.append('p')
            .html('Tweets: ' + set.counted);
        
        this.desc_b.selectAll('*').remove();
        var cmp = false;
        if(comparesetname) {
            cmp = this.data[comparesetname];
            if(cmp && cmp.counted) {
                this.desc_b.append('h3')
                    .html('Set B: ' + cmp.label);
                this.desc_b.append('h4')
                    .html(cmp.collection + ' ' + cmp.id);
                this.desc_b.append('p')
                    .html('Tweets: ' + cmp.counted);
            } else {
                cmp = false;
            }
        }
    
        // Add header
        this.feature_divs.select('p')
            .html(function(d) {
                var basis = d.split(' ')[0];
                var info = ''
                if(set.counter[d].not_applicable) {
                    info += '# ' + basis + 's: ' + util.formatThousands(set['n' + basis + 's'] - set.counter[d].not_applicable)
                    info += ' of ' + util.formatThousands(set['n' + basis + 's']);
                    if(cmp) {
                        info += ' in A, ' + util.formatThousands(cmp['n' + basis + 's'] - cmp.counter[d].not_applicable);
                        info += ' of ' + util.formatThousands(cmp['n' + basis + 's']) + ' in B';
                    } 
                } else {
                    info += '# ' + basis + 's: ' + util.formatThousands(set['n' + basis + 's'])
                    if(cmp) info += ' in A, ' + util.formatThousands(cmp['n' + basis + 's']) + ' in B';
                }
                info += '<br/> # Tokens: ' + util.formatThousands(set.counter[d].tokens);
                if(cmp) info += ' in A, ' + util.formatThousands(cmp.counter[d].tokens) + ' in B';
                return info;
            });
        
        // Add statistics for quantitative features
        this.hierarchy_flatted.forEach(this.buildQuantTable.bind(this, set, cmp));
        
        // Add tables of counts
        this.hierarchy_flatted.forEach(this.buildNominalTable.bind(this, set, cmp));
        
        triggers.emit('counters:show');
    },
    buildQuantTable: function(set, cmp, feature) {
        if(!this.featureIsQuantitative(feature)) return;

        // Get page elements
        var table_id = '.table-' + util.simplify(feature);
        var table = this.feature_divs.select(table_id)
            .classed('stats-table', true)
            .classed('token-freq-table', false);

        // Compute stats
        var stats = set.counter[feature].statistics();
        var cmp_stats = {};
        if(cmp) {
            cmp_stats = cmp.counter[feature].statistics();
        }

        // Header
        var header = table.select('thead');
        header.selectAll('*').remove();
        header.append('tr');
        header.select('tr').append('th')
            .attr('class', 'stat-token')
            .html('Quantity');
        header.select('tr').append('th')
            .attr('class', 'stat-value')
            .html('A');
        header.select('tr').append('th')
            .attr('class', 'stat-cmp')
            .html('B');

        // Add any new rows
        var new_rows = table.select('tbody').selectAll('tr')
            .data(Object.keys(stats))
            .enter()
            .append('tr')
            .style('border-top', function(d) { 
                return d == 'Mean' ? '3px solid' : 'none';
            });

        new_rows.append('td')
            .attr('class', 'stat-token');
        new_rows.append('td')
            .attr('class', 'stat-value');
        new_rows.append('td')
            .attr('class', 'stat-cmp');

        // Push Data
        var rows = table.select('tbody').selectAll('tr');
        rows.select('td').html(function(d) { return d; });
        rows.select('td.stat-value')
            .html(function(d) {
                var val = parseInt(stats[d]);

                if(feature.includes('Normal')) {
                    var formatted = val.toFixed(2);//util.formatTimeCount(val, 's');
                    return formatted;
                } else if(feature.includes('Interval')) {
                    var formatted = util.formatMinutes(val);
                    return formatted;
                }

                if(val == 0) return '0<span style="opacity: 0">.0</span>';
                var formatted = util.formatThousands(val);
                if(val % 1 > 0) {
                    formatted += (val % 1).toFixed(1).slice(1);
                } else {
                    formatted += '<span style="opacity: 0">.0</span>';
                }
//                if(val % 1 > 0) val = val.toFixed(1);
                return formatted; 
            });
        rows.select('td.stat-cmp')
            .html(function(d) {
                if(cmp_stats && d in cmp_stats) {
                    var val = cmp_stats[d];
                    if(typeof(val) == 'string') {
                        val = parseFloat(val);
                    }
                    if(feature.includes('Normal')) {
                        return val.toFixed(2);
                     } else if(feature.includes('Interval')) {
                        var formatted = util.formatMinutes(val);
                        return formatted;
                    }

                    if(val == 0) return '0<span style="opacity: 0">.0</span>';
                    var formatted = util.formatThousands(val);
                    if(val % 1 > 0) {
                        formatted += (val % 1).toFixed(1).slice(1);
                    } else {
                        formatted += '<span style="opacity: 0">.0</span>';
                    }
                    return formatted; 
                } else {
                    return '';
                }
            });

        // Show/hide comparison cells
        table.selectAll('.stat-cmp')
            .style('display', cmp ? 'table-cell' : 'none');
    },
    buildNominalTable: function(set, cmp, feature) {
        var n = parseInt(this.ops['Display']['TopX'].get());
        var excludeStopwords = this.ops['Display']['Exclude Stopwords'].is('true');
        var count_quantity = this.ops['Display']['Count Quantity'].get();
        var cmp_quantity = this.ops['Display']['Cmp Quantity'].get();
        var order_by = this.ops['Display']['Order'].get();
        var order_sign =  this.ops['Display']['Ascending'].is('asc') ? -1 : 1;
        var abs = false;
        if (order_by == 'Token') {
            order_sign *= -1;
        } else if(order_by == 'Comparison') {
            order_by = cmp_quantity;
        } else if(order_by == 'Comparison Magnitude') {
            abs = true;
            order_by = cmp_quantity;
            if(cmp_quantity.includes('Ratio')) {
               order_by = 'Log Ratio';
            }
        }
        
        if(this.featureIsQuantitative(feature)) return;

        var basis = feature.split(' ')[0];

        var table_id = '.table-' + util.simplify(feature);
        var table = this.feature_divs.select(table_id)
            .classed('stats-table', false)
            .classed('token-freq-table', true);

        // Add header if necessary
        var header = table.select('thead')
            .selectAll('tr')
            .data(function(d) { return [d]; })
            .enter()
            .append('tr');

        header.append('th')
            .attr('class', 'token')
            .html('Term');
        header.append('th')
            .attr('class', 'freq')
            .html('A');
        header.append('th')
            .attr('class', 'freq cell-cmp')
            .html('B');
        header.append('th')
            .attr('class', 'freq cell-cmp')
            .html('Cmp');

        var top_tokens;
        if(excludeStopwords && feature.includes('gram')) {
            top_tokens = set.counter[feature].top_no_stopwords(n).map(function(d) { return d.key; });
        } else {
            top_tokens = set.counter[feature].top(n).map(function(d) { return d.key; });
        }
        if(cmp) {
            var cmp_tokens;
            if(excludeStopwords && feature.includes('gram')) {
                cmp_tokens = cmp.counter[feature].top_no_stopwords(n).map(function(d) { return d.key; });
            } else {
                cmp_tokens = cmp.counter[feature].top(n).map(function(d) { return d.key; });
            }
            top_tokens = top_tokens.concat(cmp_tokens);
            top_tokens = util.lunique(top_tokens);
        }

        var entries = top_tokens.map(function(token) {
            var entry = {
                Token: util.subsetName({feature: feature, match:token}),
                Frequency: set.counter[feature].get(token)
            };
            entry['Percent']         = entry['Frequency'] / set['n' + basis + 's'] * 100;
            if(cmp) {
                entry['Frequency B'] = cmp.counter[feature].get(token);
                entry['Percent B']   = entry['Frequency B'] / cmp['n' + basis + 's'] * 100;
                entry['Difference']  = entry[count_quantity] - entry[count_quantity + ' B'];
                entry['Ratio']       = (entry[count_quantity] || 1e-5) / (entry[count_quantity + ' B'] || 1e-5);
                entry['Log Ratio']   = Math.log2(entry['Ratio']);
            }

            if(feature.includes('grams')) {
                var words = token.split(' ');
                var found = false;
                var partially_found = false;

                // Check all keywords that they line up
                set.EventEntry.Keywords.forEach(function(keyword) { 
                    var keyword_parts = keyword.split(' ');
                    var words_found = words.filter(function(word) {
                        return keyword_parts.includes(word);
                    });
                    found |= words.length == words_found.length && words.length == keyword_parts.length;
                    partially_found |= words_found.length > 0;
                });

                // If perfect match return, otherwise check old keywords
                if(found) {
                    entry['In Capture Keywords'] = 'Final Keyword';
                } else {
                    set.EventEntry.OldKeywords.forEach(function(keyword) { 
                        var keyword_parts = keyword.split(' ');
                        var words_found = words.filter(function(word) {
                            return keyword_parts.includes(word);
                        });

                        found |= words.length == words_found.length && words.length == keyword_parts.length;
                        partially_found |= words_found.length > 0;
//                            var matches = words_found.length / keyword_parts.length;
//                            if(matches == 1) found = true;
//                            if(matches > 0) partially_found = true;
                    });

                    if(found) {
                        entry['In Capture Keywords'] = 'Early Keyword';
                    } else if(partially_found) {
                        entry['In Capture Keywords'] = 'In Parts of Keyword';
                    }
                }

                // TODO check subsets
            } else if(feature != 'Text') { // Check subsets TODO fix
//                    this.dataset.subsets_arr.forEach(function(subset) {
//                        if(subset.Feature.replace('.','') == feature) {
//                            if(subset.Match == token) {
//                                entry['In Generated Subset'] = subset.ID;
//                            }
//                        }
//                    })
            }


            return entry;
        }, this);

        // Sort Entries
        entries.sort(function(a, b) {
            if(order_by == 'Frequency Combined') {
                if(a['Frequency'] + a['Frequency B'] < b['Frequency'] + b['Frequency B']) return  1 * order_sign;
                if(a['Frequency'] + a['Frequency B'] > b['Frequency'] + b['Frequency B']) return -1 * order_sign;
            } else if(abs) {
                if(Math.abs(a[order_by]) < Math.abs(b[order_by])) return  1 * order_sign;
                if(Math.abs(a[order_by]) > Math.abs(b[order_by])) return -1 * order_sign;
            } else {
                if(a[order_by] < b[order_by]) return  1 * order_sign;
                if(a[order_by] > b[order_by]) return -1 * order_sign;
            }
            if(a['Token']  < b['Token'] ) return  1 * order_sign;
            if(a['Token']  > b['Token'] ) return -1 * order_sign;
            return 0;
        });

        // Format Numbers
        entries.forEach(function(entry) {
            entry['Frequency'] = util.formatThousands(entry['Frequency']);
            entry['Percent']   = entry['Percent'].toFixed(1);
            if(cmp) {
                entry['Frequency B'] = util.formatThousands(entry['Frequency B']);
                entry['Difference']  = util.formatThousands(entry['Difference']) || 0;
                entry['Percent B']   = entry['Percent B'].toFixed(1);

                var neg_ratio = entry['Ratio'] < 1;
                if(entry['Ratio'] == Infinity || entry['Ratio'] > 1e4) {
                    entry['Ratio'] = '&infin;' 
                    entry['Log Ratio'] = '&infin;' 
                } else if(entry['Ratio'] == 0 || entry['Ratio'] < 1e-4) {
                    entry['Ratio'] = 0;
                    entry['Log Ratio'] = '-&infin;' 
                } else {
                    entry['Ratio'] = entry['Ratio'].toFixed(1);
                    entry['Log Ratio'] = entry['Log Ratio'].toFixed(1);
                }
                if(neg_ratio) {
                    entry['Difference'] = '<span class="ratio-neg">' + entry['Difference'] + '</span>';
                    entry['Ratio'] = '<span class="ratio-neg">' + entry['Ratio'] + '</span>';
                    entry['Log Ratio'] = '<span class="ratio-neg">' + entry['Log Ratio'] + '</span>';
                }
            }
        });

        // Add rows
        var rows = table.select('tbody')
            .selectAll('tr.token-freq-set')
            .data(entries);

        var rows_new = rows.enter()
            .append('tr')
            .attr('class', function(d, i) { 
                return 'row' + i + ' row-polar' + (i % 2) + ' token-freq-set';
            });

        rows_new.append('td')
            .attr('class', 'token');
        rows_new.append('td')
            .attr('class', 'freq freq-primary');
        rows_new.append('td')
            .attr('class', 'freq freq-secondary cell-cmp');
        rows_new.append('td')
            .attr('class', 'freq freq-cmp cell-cmp');

        rows.exit().remove();

        // Propagate data
        rows.select('td.token');
        rows.select('td.freq-primary');
        rows.select('td.freq-secondary');
        rows.select('td.freq-cmp');

        // Attach tooltip
        this.tooltip.attach(table_id + ' .token-freq-set', function(d) { return d; });

        // Attach user information
        if(feature.includes('Screenname / User ID')) {
            rows.on('click', this.inspectUser.bind(this))
                .classed('inspect_user', true);
        }
    },
    showCounts: function() {
        var count_quantity = this.ops['Display']['Count Quantity'].get();
        var cmp_quantity = this.ops['Display']['Cmp Quantity'].get();
        var comparesetname = this.dataset.subset2 ? 'Subset '  + this.dataset.subset2.ID :
                             this.dataset.event2  ? 'Event '   + this.dataset.event2.ID : '';
        var cmp = comparesetname ? this.data[comparesetname] : '';
        
        // Set classes
        this.feature_divs.selectAll('.token-freq-set')
            .classed('token-keyword', function(d) {
                return d['In Capture Keywords'] && d['In Capture Keywords'] == 'Final Keyword';
            })
            .classed('token-partial-keyword', function(d) {
                return d['In Capture Keywords'] && d['In Capture Keywords'] != 'Final Keyword';
            })
            .classed('token-subset', function(d) {
                return d['In Generated Subset'];
            });
        
        // Populate data
        this.feature_divs.selectAll('tbody .token')
            .html(function(d) { 
                return d['Token'];
            });
        this.feature_divs.selectAll('tbody .freq-primary')
            .html(function(d) {
                return d[count_quantity]; 
            });
        
        if(cmp) {
            this.feature_divs.selectAll('.cell-cmp')
                .classed('cell-hidden', false);
            
            this.feature_divs.selectAll('tbody .freq-secondary')
                .html(function(d) { 
                    return d[count_quantity + ' B']; 
                });
            this.feature_divs.selectAll('tbody .freq-cmp')
                .html(function(d) {
                    return d[cmp_quantity];
                });
        } else {
            this.feature_divs.selectAll('.cell-cmp')
                .classed('cell-hidden', true);
        }
        
        triggers.emit('counters:visibility');
    },
    toggleCounterVisibility: function() {
        if(this.ops['Display']['Show Major'].is('only Major')) {
            d3.selectAll('.feat_type, .feature')
                .classed('hidden-table', true);
            
            // Iterate through the hierachy of tables & only show ones that are considered major
            // TODO, in the future, don't even count them to speed up the process
            Object.keys(this.hierarchy_major).forEach(function(level1) {
                var counters1 = this.hierarchy_major[level1];
                Object.keys(counters1).forEach(function(level2) {
                    d3.select('.feat_type-' + util.simplify(level1 + '__' + level2))
                        .classed('hidden-table', false);
                    var counters2 = counters1[level2];
                    counters2.forEach(function(counter) {
                        d3.select('.feature-' + util.simplify(level1 + '__' + level2 + '__' + counter))
                            .classed('hidden-table', false);
                    }, this);
                }, this);
            }, this);
            
        } else {
            d3.selectAll('.feat_type, .feature')
                .classed('hidden-table', false);
        }
    },
    inspectUser: function(row) {
        // Just gets primary set now
        var setname = this.dataset.subset ? 'Subset ' + this.dataset.subset.ID : 
                                            'Event '  + this.dataset.event.ID;
        var cmpsetname = this.dataset.subset2 ? 'Subset '  + this.dataset.subset2.ID :
                         this.dataset.event2  ? 'Event '   + this.dataset.event2.ID : '';
        
        // Get data
        var userID = row.Token.split(' - ')[1];
        var user = 0;
        var cmpuser = 0;
        var sets = setname;
        
        // If not in the initial set, change the set
        if(!(userID in this.data[setname].users)) {
            setname = cmpsetname;
            sets = setname;
            if(!(userID in this.data[setname].users)) {
                triggers.emit('alert', 'Unable to find user ' + row.Token);
                return;
            }
        } else if(cmpsetname && cmpsetname in this.data && userID in this.data[cmpsetname].users) {
            cmpuser = this.data[cmpsetname].users[userID];
            sets += ' & ' + cmpsetname;
        }
        user = this.data[setname].users[userID];
        
        // Configure data
        var keys = Object.keys(user);
        keys = keys.filter(function(key) {
            return key != 'DescriptionWords' &&
                 key != 'TweetIntervals' &&
                 key != 'TweetIntervals';
        });
        
        // Start the modal
        triggers.emit('modal:reset');
        triggers.emit('modal:title', 'Inspecting User <a href="http://twitter.com/' + user.Screenname + '" target="_blank">' +
                      user.UserID + ' - ' + user.Screenname + '</a> in ' + sets);
        
        // Fill the modal
        var modal_body = this.modal.body;
        
        var table = modal_body.append('table')
            .attr('class', 'inspect-table');
        var rows = table.selectAll('tr')
            .data(keys)
            .enter()
            .append('tr');
        
        rows.append('th')
            .style('width', cmpuser ? '20%' : '30%')
            .attr('class', 'inspect-key')
            .html(function(label) { return label.replace(/([a-z])([A-Z])/g, "$1 $2"); });
        
        rows.append('td')
            .attr('class', 'inspect-value')
            .style('width', cmpuser ? '40%' : '70%')
            .html(function(label) {
                var val = user[label];
            
                if(label == 'Age')
                    return util.formatTimeCount(val * 24 * 60 * 60, 'd');
                if(label == 'CreatedAt')
                    return util.formatDateToYMD(val);
                if(label.includes('Minute'))
                    return util.formatTimeCount(val * 60, 'm');
                if(['Lang', 'UTCOffset', 'Verified'].includes(label))
                    return util.subsetName({feature: label, match: val});
                if(label == 'FirstTweet' || label == 'LastTweet') {
                    return val + '&nbsp;&nbsp;&nbsp;&nbsp;' + 
                        util.formatDate(util.twitterID2Timestamp(val));
                }
                if(val instanceof Counter) {
                    var topwords = val.top_no_stopwords(10);
                    var result = '';
                    return topwords.map(function(kvpair) {
                        return kvpair.key + ' (' + kvpair.value + ')';
                    }).join('&nbsp;&nbsp;&nbsp;&nbsp;');
                }
                if(label == 'TweetInterval') {
                    return ['Min', 'Max', 'Med', 'Ave', 'Dev', 'NormDev'].map(function(key, i) { 
                        if(key == 'All') return '';
                        var value = val[key] || 0;
                        if(typeof(value) == 'string') value = parseFloat(value);
                        if(key == 'NormDev') {
                            value = value.toFixed(2);
                        } else {
                            value = util.formatTimeCount(value * 60, 'm');
                        }
                        return '<em>' + key + '</em>: ' + value + (i % 2 == 1 ? '<br />' : '&nbsp;&nbsp;&nbsp;&nbsp;');
                    }).join('');
                }
            
                if(typeof(val) == 'number' && val % 1 != 0 && val < 1)
                    return val.toFixed(2);
                if(typeof(val) == 'number' && val % 1 != 0) 
                    return val.toFixed(1);
                if(typeof(val) == 'number') 
                    return val.toFixed(0);
                if(val instanceof Array) return val.join(', ');
                if(val instanceof Date) return util.formatDate(val);
            
                if(val == null) return '<em>None</em>';
            
                if(typeof(val) == 'object') {
                    var inner_keys = Object.keys(val);
                    return inner_keys.map(function(key) { 
                        var value = val[key];
                        if(typeof(value) == 'number' && value % 1 != 0 && value < 1)
                            value = value.toFixed(2);
                        if(typeof(value) == 'number' && value % 1 != 0) 
                            value = value.toFixed(1);
                        if(typeof(value) == 'number') 
                            value = value.toFixed(0);
                        return '<em>' + key + '</em>: ' + value;
                    }).join('&nbsp;&nbsp;&nbsp;&nbsp;');
                }
                return val; 
            });
        
        if(cmpuser) {
            rows.append('td')
                .attr('class', 'inspect-value')
                .style('width', '40%')
                .html(function(label) {
                    var val = cmpuser[label];

                    if(label == 'Age')
                        return util.formatTimeCount(val * 24 * 60 * 60, 'd');
                    if(label == 'CreatedAt')
                        return util.formatDateToYMD(val);
                    if(label.includes('Minute'))
                        return util.formatTimeCount(val * 60, 'm');
                    if(['Lang', 'UTCOffset', 'Verified'].includes(label))
                        return util.subsetName({feature: label, match: val});
                    if(label == 'FirstTweet' || label == 'LastTweet') {
                        return val + '&nbsp;&nbsp;&nbsp;&nbsp;' + 
                            util.formatDate(util.twitterID2Timestamp(val));
                    }
                    if(val instanceof Counter) {
                        var topwords = val.top_no_stopwords(10);
                        var result = '';
                        return topwords.map(function(kvpair) {
                            return kvpair.key + ' (' + kvpair.value + ')';
                        }).join('&nbsp;&nbsp;&nbsp;&nbsp;');
                    }
                    if(label == 'TweetInterval') {
                        return ['Min', 'Max', 'Med', 'Ave', 'Dev', 'NormDev'].map(function(key, i) { 
                            if(key == 'All') return '';
                            var value = val[key] || 0;
                            if(typeof(value) == 'string') value = parseFloat(value);
                            if(key == 'NormDev') {
                                value = value.toFixed(2);
                            } else {
                                value = util.formatTimeCount(value * 60, 'm');
                            }
                            return '<em>' + key + '</em>: ' + value + (i % 2 == 1 ? '<br />' : '&nbsp;&nbsp;&nbsp;&nbsp;');
                        }).join('');
                    }

                    if(typeof(val) == 'number' && val % 1 != 0 && val < 1)
                        return val.toFixed(2);
                    if(typeof(val) == 'number' && val % 1 != 0) 
                        return val.toFixed(1);
                    if(typeof(val) == 'number') 
                        return val.toFixed(0);
                    if(val instanceof Array) return val.join(', ');
                    if(val instanceof Date) return util.formatDate(val);

                    if(val == null) return '<em>None</em>';

                    if(typeof(val) == 'object') {
                        var inner_keys = Object.keys(val);
                        return inner_keys.map(function(key) { 
                            var value = val[key];
                            if(typeof(value) == 'number' && value % 1 != 0 && value < 1)
                                value = value.toFixed(2);
                            if(typeof(value) == 'number' && value % 1 != 0) 
                                value = value.toFixed(1);
                            if(typeof(value) == 'number') 
                                value = value.toFixed(0);
                            return '<em>' + key + '</em>: ' + value;
                        }).join('&nbsp;&nbsp;&nbsp;&nbsp;');
                    }
                    return val; 
                });
        }
        
        triggers.emit('modal:open');
    },
    uploadAllUserStats: function(setname) {
        var set = this.data[setname];
        var userIDs = Object.keys(set.users);
        
        set.user_upload = {
            userIDs: userIDs,
            i_user: 0,
            n_users: userIDs.length,
            prog: new Progress({
                steps: userIDs.length,
                text: '{cur}/{max} Users Uploaded',
            }),
            stop: function() {
                this.i_user = this.n_users;
            }
        };
        
        set.user_upload.prog.start();
        this.continueUserUpload(set);
    },
    continueUserUpload: function(set) {
        var i_user = set.user_upload.i_user;
        if(i_user < 0 || i_user >= set.user_upload.n_users) {
            set.user_upload.prog.end();
            return;
        }
        set.user_upload.prog.update(i_user);
        
        // Configure user's data
        var userID = set.user_upload.userIDs[i_user];
        var user = set.users[userID];
        
        var post = {
            Event: set.EventEntry.ID,
            Subset: 'Subset' in set ? set.subset.ID : 0,
        };
        
        ['UserID', 'Screenname',
         'Tweets', 'FirstTweet', 'LastTweet', 'TweetsPerDay',
         'MinutesInSet', 'MinuteStarted', 'MinuteEnded', 'Age', 
         'Words', 'DistinctWords', 'WordsPerTweet', 'DistinctWordsPerTweet',
         'URLs', 'URLsPerTweet', 'DistinctDomains', 'DistinctDomainsPerURL',
         'Mentions', 'SimpleMentions',
         'MentionsOfUser', 'RetweetsOfUser', 'RepliesOfUser', 'QuotesOfUser', 'SimpleMentionsOfUser']
            .forEach(function(feature) {
            post[feature] = user[feature];
        });
        
        ['Distinct', 'Originals', 'Retweets', 'Replies', 'Quotes'].forEach(function(feature) {
            post[feature] = user[feature]['Count'];
            post['Fraction' + feature] = user[feature]['Fraction'];
        });
        ['Statuses', 'Followers', 'Following', 'Listed', 'Favorites'].forEach(function(feature) {
            post[feature + 'AtStart'] = user[feature]['Start'];
            post[feature + 'GainFirstToLast'] = user[feature]['Growth'];
            post[feature + 'GainPerDay'] = user[feature]['PerDay'];
        });
        ['Min', 'Max', 'Ave', 'Med', 'Dev', 'NormDev'].forEach(function(feature) {
            post[feature + 'MinutesBetweenTweets'] = user['TweetInterval'][feature];
        });
        
        var failure_func = function(msg) { // Failure
            console.error(msg);
            set.user_upload.prog.end();
            triggers.emit('alert', 'Error uploading users');
            return;
        }
        
        this.connection.php('analysis/uploadUserStats', post,
            function(msg) { // Success
                if(msg == '1') { // Definitely success!
                    set.user_upload.i_user++;
                    setTimeout(this.continueUserUpload.bind(this, set), 1); // prevents a large call stack
                } else {
                    failure_func(msg);
                }
            }.bind(this), failure_func);
        
    },
    userMentionsUpload: function(setname) {
        var set = this.data[setname];
        if(!set) return;
        
        var upload_limit = this.ops['Download']['Upload Limit'].get();
        
        // Build list of user tuples
        var relations = [];
        Object.keys(set.users).forEach(function(userID) {
            var user = set.users[userID];
            var otherusers = user['UsersMentioned'].top(upload_limit);
            otherusers.concat(user['UsersRetweeted'].top(upload_limit));
            otherusers.concat(user['UsersReplied'].top(upload_limit));
            otherusers.concat(user['UsersQuoted'].top(upload_limit));
            otherusers.concat(user['UsersSimplyMentioned'].top(upload_limit));
            otherusers = util.lunique(otherusers.map(u => u.key));
            
            otherusers.forEach(function(otheruser) {
                var mentionID = this.screenname2ID[otheruser.toLowerCase()];
                if(!mentionID) {
                    mentionID = -1 * util.mod(otheruser.hashCode(), 1e9);
                } 
                
                var relation = {
                    ActiveUserID: userID,
                    SecondUserID: mentionID,
                    MentionCount: user['UsersMentioned'].get(otheruser),
                    RetweetCount: user['UsersRetweeted'].get(otheruser),
                    ReplyCount: user['UsersReplied'].get(otheruser),
                    JustMentionCount: user['UsersSimplyMentioned'].get(otheruser),
                    QuoteCount: user['UsersQuoted'].get(otheruser)
                }
                
                // Add these stats to other user
                if(mentionID > 0 && mentionID in set.users) {
                    var userB = set.users[mentionID];
                    userB['MentionsOfUser'] += relation.MentionCount || 0;
                    userB['RetweetsOfUser'] += relation.RetweetCount || 0;
                    userB['RepliesOfUser'] += relation.ReplyCount || 0;
                    userB['QuotesOfUser'] += relation.QuoteCount || 0;
                    userB['SimpleMentionsOfUser'] += relation.JustMentionCount || 0;
                }
                
                // TODO Not included, yet
//                'Follower', 'Following', 
//                  'MutualFollowers', 'MutualFollowing', 'MutualConnections'
//                  'CombinedFollowers', 'CombinedFollowing', 'CombinedConnections'
//                  'FractionMutualFollowers', 'FractionMutualFollowing', 'FractionsMutualConnections'
                
                relations.push(relation);
            }, this);
        }, this);
        
        // Start upload
        
        set.usermention_upload = {
            relations: relations,
            index: 0,
            total: relations.length,
            prog: new Progress({
                steps: relations.length,
                text: '{cur}/{max} User Mentions Uploaded',
            }),
            stop: function() {
                this.i_user = this.n_users;
            }
        };
        
        set.usermention_upload.prog.start();
        this.continueUserMentionUpload(set);
    },
    continueUserMentionUpload: function(set) {
        var index = set.usermention_upload.index;
        if(index < 0 || index >= set.usermention_upload.total) {
            set.usermention_upload.prog.end();
            return;
        }
        set.usermention_upload.prog.update(index);
        
        // Configure packet
        var relation = set.usermention_upload.relations[index];
        
        var post = relation;
        post.Event = set.EventEntry.ID;
        post.Subset = 'SubsetEntry' in set ? set.SubsetEntry.ID : 0;
        
        // Configure functions
        var failure = function(msg) { // Failure
            console.error(msg);
            set.usermention_upload.prog.end();
            triggers.emit('alert', 'Error uploading user mentions');
            return;
        };
        
        var success =  function(msg) { // Success
            if(msg == '1') { // Definitely success!
                set.usermention_upload.index++;
                setTimeout(this.continueUserMentionUpload.bind(this, set), 1); // prevents a large call stack
            } else {
                failure(msg);
            }
        }.bind(this);
        
        // Upload!
        this.connection.php('analysis/uploadUserSocial', post, success, failure);
    },
    userLexiconUpload: function(setname) {
        var set = this.data[setname];
        if(!set) return;
        
        var upload_limit = this.ops['Download']['Upload Limit'].get();
        
        // Build list of user tuples
        var userIDs = Object.keys(set.users);
        var lexicon = [];
        userIDs.forEach(function(userID) {
            var top_words = [];
            var top_words_low = 0;
            var top_descs = [];
            var top_descs_low = 1e-6;
            
            var user = set.users[userID];
            
            var words = user.TweetWords.top_no_stopwords(upload_limit);
            var desc = util.lunique(user.DescriptionWords.filter(x => !util.stopwords.has(x)));
            
            words.forEach(function(word) {
                if(word) {
                    lexicon.push({
                        User: userID,
                        Term: word.key,
                        Count: word.value
                    });
                }
            });
            desc.forEach(function(word) {
                if(word) {
                    lexicon.push({
                        User: userID,
                        Term: word
                    });
                }
            });
        });
        
        // Start upload
        set.user_lex_upload = {
            lexicon: lexicon,
            index: 0,
            total: lexicon.length,
            prog: new Progress({
                steps: lexicon.length,
                text: '{cur}/{max} User Words Uploaded',
            }),
            stop: function() {
                this.i_user = this.n_users;
            }
        };
        
        set.user_lex_upload.prog.start();
        this.continueUserLexiconUpload(set);
    },
    continueUserLexiconUpload: function(set) {
        var index = set.user_lex_upload.index;
        if(index < 0 || index >= set.user_lex_upload.total) {
            set.user_lex_upload.prog.end();
            return;
        }
        set.user_lex_upload.prog.update(index);
        
        // Configure packet
        var lexicon_entry = set.user_lex_upload.lexicon[index];
        
        var post = lexicon_entry;
        post.Event = set.EventEntry.ID;
        post.Subset = 'SubsetEntry' in set ? set.SubsetEntry.ID : 0;
        post.Term = post.Term.slice(0, 20).replace(/'/g, "\\'");
        
        // Configure functions
        var failure = function(msg) { // Failure
            console.error(msg);
            set.user_lex_upload.prog.end();
            triggers.emit('alert', 'Error uploading user terms');
            return;
        };
        
        var success =  function(msg) { // Success
            if(msg == '1') { // Definitely success!
                set.user_lex_upload.index++;
                setTimeout(this.continueUserLexiconUpload.bind(this, set), 1); // prevents a large call stack
            } else {
                failure(msg);
            }
        }.bind(this);
        
        // Upload!
        this.connection.php('analysis/uploadUserTerm', post, success, failure);
    },
    userLexicalRelationUpload: function(setname) {
        var set = this.data[setname];
        if(!set) return;
        
        var upload_limit = this.ops['Download']['Upload Limit'].get();
        
        // Build list of user tuples
        var userIDs = Object.keys(set.users);
        var relations = [];
        userIDs.forEach(function(idA) {
            var top_words = [];
            var top_words_low = 0;
            var top_descs = [];
            var top_descs_low = 1e-6;
            
            var userA = set.users[idA];
            
            userIDs.forEach(function(idB) {
                if(idA == idB) return;
                
                var relation; 
                var relation_desc;
                
                var userB = set.users[idB];
                
                // Get words between tweets in common
                var wordsA = new Set(userA.TweetWords.top_no_stopwords(500).map(d => d.key));
                var wordsB = new Set(userB.TweetWords.top_no_stopwords(500).map(d => d.key));
                
                if(wordsA.size > 0 || wordsB.size > 0) {
                    var intersection = new Set(Array.from(wordsA).filter(x => wordsB.has(x)));
                    var union = new Set([...wordsA, ...wordsB]);
                    
                    relation = {
                        ActiveUserID: idA,
                        MentionedUserID: idB,
                        MutualWords: intersection.size,
                        CombinedWords: union.size,
                        FractionMutualWords: intersection.size / union.size,
                    }
                }
                
                // Check if it is one of the top relations
                if(relation && relation.MutualWords && relation.FractionMutualWords >= top_words_low) {
                    top_words.push(relation);
                    
                    if(upload_limit < 1e5 && relation.FractionMutualWords > top_words_low) {
                        var n_top_words = top_words.length;
                        if(n_top_words > upload_limit) {
                            var top_words_limited = top_words.filter(rel => rel.FractionMutualWords > top_words_low);
                            var n_top_words_over_low = top_words_limited.length;
                            if(n_top_words_over_low >= upload_limit) {
                                top_words_low = d3.min(top_words, rel => rel.FractionMutualWords);
                                top_words = top_words_limited;
                            }
                        }
                    }
                }
                
                // Gets words in description in common
                var descA = new Set(userA.DescriptionWords.filter(x => !util.stopwords.has(x)));
                var descB = new Set(userB.DescriptionWords.filter(x => !util.stopwords.has(x)));
                
                // TODO filter better when the intersection is filler words
                descA.delete(null);
                descB.delete(null);
                if(descA.size > 0 || descB.size > 0) {
                    var intersection = new Set(Array.from(descA).filter(x => descB.has(x)));
                    var union = new Set([...descA, ...descB]);
                    
                    relation_desc = {
                        ActiveUserID: idA,
                        MentionedUserID: idB,
                        MutualDescWords: intersection.size,
                        CombinedDescWords: union.size,
                        FractionMutualDescWords: intersection.size / union.size,
                    }
                }
                
                // Check if it is one of the top relations
                if(relation_desc && relation_desc.MutualDescWords && relation_desc.FractionMutualDescWords >= top_descs_low) {
                    top_descs.push(relation_desc);
                    
                    if(upload_limit < 1e5 && relation_desc.FractionMutualDescWords > top_descs_low) {
                        var n_top_descs = top_descs.length;
                        if(n_top_descs > upload_limit) {
                            var top_descs_limited = top_descs.filter(rel => rel.FractionMutualDescWords > top_descs_low);
                            var n_top_descs_over_low = top_descs_limited.length;
                            if(n_top_descs_over_low >= upload_limit) {
                                top_descs_low = d3.min(top_descs, rel => rel.FractionMutualDescWords);
                                top_descs = top_descs_limited;
                            }
                        }
                    }
                }
            });
            
//            console.log(userA.Screenname, top_words.length, d3.min(top_words, rel => rel.) top_words,);
            
            // If there is a tie for last place, randomly filter out the last place.
            if(top_words.length > 0) {
                if(top_words.length > upload_limit) {
                    var len = top_words.length;
                    var min = d3.min(top_words, rel => rel.FractionMutualWords);
                    var min_entries  = top_words.filter(rel => rel.FractionMutualWords = min)
                    var okay_entries = top_words.filter(rel => rel.FractionMutualWords > min)
                    
                    // Randomly pop out elements from the array until we are at the upload limit
                    while (okay_entries.length <= upload_limit && min_entries.length != 0) {
                        okay_entries.push(min_entries.splice(Math.floor(Math.random() * min_entries.length), 1)[0]);
                    }
                    top_words = okay_entries;
                }
                
                top_words.forEach(rel => relations.push(rel));
            }
            
            // If there is a tie for last place, randomly filter out the last place.
            if(top_descs.length > 0) {
                if(top_descs.length > upload_limit) {
                    var len = top_descs.length;
                    var min = d3.min(top_descs, rel => rel.FractionMutualDescWords);
                    var min_entries  = top_descs.filter(rel => rel.FractionMutualDescWords = min)
                    var okay_entries = top_descs.filter(rel => rel.FractionMutualDescWords > min)
                    
                    // Randomly pop out elements from the array until we are at the upload limit
                    while (okay_entries.length <= upload_limit && min_entries.length != 0) {
                        okay_entries.push(min_entries.splice(Math.floor(Math.random() * min_entries.length), 1)[0]);
                    }
                    top_descs = okay_entries;
                }
                top_descs.forEach(rel => relations.push(rel));
            }
                
            console.log(userA.Screenname, top_words, top_descs);
        });
        
        // Start upload
        
        set.user_lexical_relations_upload = {
            relations: relations,
            index: 0,
            total: relations.length,
            prog: new Progress({
                steps: relations.length,
                text: '{cur}/{max} User Lexical Relations Uploaded',
            }),
            stop: function() {
                this.i_user = this.n_users;
            }
        };
        
        set.user_lexical_relations_upload.prog.start();
        this.continueUserLexicalRelationUpload(set);
    },
    continueUserLexicalRelationUpload: function(set) {
        var index = set.user_lexical_relations_upload.index;
        if(index < 0 || index >= set.user_lexical_relations_upload.total) {
            set.user_lexical_relations_upload.prog.end();
            return;
        }
        set.user_lexical_relations_upload.prog.update(index);
        
        // Configure packet
        var relation = set.user_lexical_relations_upload.relations[index];
        
        var post = relation;
        post.Event = set.EventEntry.ID;
        post.Subset = 'SubsetEntry' in set ? set.SubsetEntry.ID : 0;
        
        // Configure functions
        var failure = function(msg) { // Failure
            console.error(msg);
            set.user_lexical_relations_upload.prog.end();
            triggers.emit('alert', 'Error uploading user lexical relations');
            return;
        };
        
        var success =  function(msg) { // Success
            if(msg == '1') { // Definitely success!
                set.user_lexical_relations_upload.index++;
                setTimeout(this.continueUserLexicalRelationUpload.bind(this, set), 1); // prevents a large call stack
            } else {
                failure(msg);
            }
        }.bind(this);
        
        // Upload!
        this.connection.php('analysis/uploadUserRelations', post, success, failure);
    },
    userSourceUpload: function(setname) {
        var set = this.data[setname];
        if(!set) return;
        
        var mobileclients = new Set(['Mobile Web', 'Mobile Web (M5)', 'Mobile Web (M2)', 'Twitter for Android', 'Twitter for iPhone', 'Twitter for Windows Phone', 'Twitter for iPad', 'Twitter for Blackberry']);
        
        // Build list of user tuples
        var userIDs = Object.keys(set.users);
        var records = [];
        userIDs.forEach(function(userID) {
            var user = set.users[userID];
            var twittermobile = d3.sum(user.Sources.top(20).filter(x => mobileclients.has(x.key)), x => x.value);
            
            var record = {
                UserID: userID,
                Screenname: user.Screenname,
                TwitterWeb: user.Sources.get('Twitter Web Client'),
                TwitterMobile: twittermobile,
                Google: user.Sources.get('Google'),
                Facebook: user.Sources.get('Facebook'),
                TweetDeck: user.Sources.get('TweetDeck'),
                IFTTT: user.Sources.get('IFTTT'),
                RoundTeam: user.Sources.get('RoundTeam'),
                Other: user.Sources.total_count
            }
            record.Other -= record.TwitterWeb + record.TwitterMobile + record.Google + record.Facebook + record.TweetDeck + record.IFTTT + record.RoundTeam;
//            if(record.Other > 0) {
//                console.log(user.Sources.top(20).map(x => x.key + ': ' + x.value).join(', '));
//            }
            
            records.push(record);
        });
        
        // Start upload
        set.user_sources_upload = {
            records: records,
            index: 0,
            total: records.length,
            prog: new Progress({
                steps: records.length,
                text: '{cur}/{max} Users\' Sources Uploaded',
            }),
            stop: function() {
                this.index = this.total;
            }
        };
        
        set.user_sources_upload.prog.start();
        this.continueUserSourceUpload(set);
    },
    continueUserSourceUpload: function(set) {
        var index = set.user_sources_upload.index;
        if(index < 0 || index >= set.user_sources_upload.total) {
            set.user_sources_upload.prog.end();
            return;
        }
        set.user_sources_upload.prog.update(index);
        
        // Configure packet
        var record = set.user_sources_upload.records[index];
        
        var post = record;
        post.Event = set.EventEntry.ID;
        post.Subset = 'SubsetEntry' in set ? set.SubsetEntry.ID : 0;
        
        // Configure functions
        var failure = function(msg) { // Failure
            console.error(msg);
            set.user_sources_upload.prog.end();
            triggers.emit('alert', 'Error uploading user terms');
            return;
        };
        
        var success =  function(msg) { // Success
            if(msg == '1') { // Definitely success!
                set.user_sources_upload.index++;
                setTimeout(this.continueUserSourceUpload.bind(this, set), 1); // prevents a large call stack
            } else {
                failure(msg);
            }
        }.bind(this);
        
        // Upload!
        this.connection.php('analysis/uploadUserSources', post, success, failure);
    },
};

function initialize() {
    FD = new FeatureDistribution();
    
    FD.init();
}
window.onload = initialize;
