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
        },
        'User Based': {
            'Activity':     ['Tweets', 'Median Interval Between Tweets', 'Deviation Interval Between Tweets', 'Normal Deviation Interval Between Tweets'],
            'Identity':     ['Username', 'Description Unigrams', 'Lang', 'Verified'],
            'Temporal':     ['Account Creation Date', 'Age of Account'],
            'Localization': ['Location', 'UTC Offset', 'Timezone'],
            'Tweet Text':   ['Using Pipe'],
            'Statuses':     ['Start', 'Growth', 'Growth &ne; 0'],
            'Followers':    ['Start', 'Growth', 'Growth &ne; 0'],
            'Following':    ['Start', 'Growth', 'Growth &ne; 0'],
            'Listed':       ['Start', 'Growth', 'Growth &ne; 0'],
            'Favorites':    ['Start', 'Growth', 'Growth &ne; 0']
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
        
//        this.getEventData();
        
        setTimeout(triggers.emitter('tweets:fetch'), 1000);
    },
    setTriggers: function() {
        
        triggers.on('event:set', this.toggleLoadButtons.bind(this, 'event'));
        triggers.on('subset:set', this.toggleLoadButtons.bind(this, 'subset'));
        
        triggers.on('event2:set', this.toggleLoadButtons.bind(this, 'event2'));
        triggers.on('subset2:set', this.toggleLoadButtons.bind(this, 'subset2'));
        
        triggers.on('counters:count', this.countFeatures.bind(this));
        triggers.on('counters:place', this.placeCounts.bind(this));
        triggers.on('counters:show', this.showCounts.bind(this));
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
                isnumeric: true
            })
        };
        this.ops['Display'] = {
            TopX: new Option({
                title: "Top",
                labels: ['10', '20', '100', '200', '1000'],
                ids:    ['10', '20', '100', '200', '1000'],
                default: 1,
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
                labels: ['Count', 'Percent'],
                ids: ['freq', 'percent'],
                callback: triggers.emitter('counters:place')
            }),
            'Cmp Quantity': new Option({
                title: 'Cmp Quantity',
                labels: ['Ratio', 'Log Ratio'],
                ids: ['ratio', 'log-ratio'],
                default: 1,
                callback: triggers.emitter('counters:show')
            }),
            'Order': new Option({
                title: 'Order by',
                labels: ['Token', 'Freq A', 'Freq B', 'Ratio', 'Ratio Magnitude'],
                ids: ['Token', 'Frequency', 'Frequency B', 'Ratio', 'Ratio Magnitude'],
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
        
        this.ops.init();
    },
    buildLoadButtons: function() {
        // Change names in the dataset selector
        this.ops.sidebar.select('#choose_lDataset_lEvent .option-label')
            .html('Event A');
        this.ops.sidebar.select('#choose_lDataset_lSubset .option-label')
            .html('Subset A');
        
        // Add load buttons
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
        
        load_buttons.append('button')
            .attr('class', 'btn btn-xs load-start')
            .html(function(d, i) { return 'Load Set ' + String.fromCharCode(65 + i); })
            .on('click', this.loadTweets.bind(this));
        
        load_buttons.append('button')
            .attr('class', 'btn btn-xs load-stop')
            .html('Stop')
            .on('click', this.abortLoadTweets.bind(this));
        
        load_buttons.append('button')
            .attr('class', 'btn btn-xs load-clear')
            .html('Clear')
            .on('click', this.clearTweets.bind(this));
    },
    toggleLoadButtons: function(collection) {
        // Get name of set
        var cmp = collection.includes('2');
        var collection_type = cmp ? collection.slice(0, -1) : collection;
        var collection_id = this.dataset[collection] ? this.dataset[collection].ID : undefined;
        var setname = collection_type + ' ' + collection_id;
        if(!collection_id && collection_type == 'subset') { // elevate to event set
            collection_type = 'event';
            collection = collection_type + (cmp ? '2' : '');
            collection_id = this.dataset[collection] ? this.dataset[collection].ID : undefined;
            setname = collection_type + ' ' + collection_id;
        }
        if (!collection_id) {
            setname = '';
        }
        
        // Set the buttons to react to that name
        var button_box = this.download_box.select('.load-button-set-' + (cmp ? 'B' : 'A'))
            .data([setname]);
        button_box.select('.load-start')
            .classed('btn-default', setname ? true : false);
        button_box.select('.load-stop')
            .classed('btn-default', setname ? true : false);
        button_box.select('.load-clear')
            .classed('btn-default', setname ? true : false);
    },
    loadTweets: function(setname) {
        var args = setname.split(' ');
        if(args.length < 2) {
            triggers.emit('alert', 'Unable to load set: ' + setname);
            return;
        }
        var collection_type = args[0];
        var collection_id = args[1];
        
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
            if(collection_type == 'subset') {
                data.subset = this.dataset['subsets'][data.id];
                data.event = this.dataset['events'][data.subset.Event];
                data.label = (data.event.DisplayName || data.event.Name) + ' - ' + data.subset.Feature + ' - ' + util.subsetName(data.subset);
            } else {
                data.event = this.dataset['events'][data.id];
                data.label = data.event.DisplayName || data.event.Name;
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
                limit = parseInt(data.subset.Tweets);
            } else {
                limit = parseInt(data.event.Tweets);
            }
        }
        
        // Initialize the connection
        data.tweet_connection = new Connection({
            url: 'tweets/get',
            post: {
                collection: collection_type,
                collection_id: collection_id
            },
            quantity: 'count',
            resolution: this.ops['Download']['Chunk Size'].get(),
            max: limit,
            on_chunk_finish: this.parseNewTweets.bind(this, setname),
            progress_text: '{cur}/{max} Loaded',
//            on_finish: triggers.emitter('counters:count', setname),
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
    parseNewTweets: function(setname, file_data) {
        var newTweets;
        try {
            newTweets = JSON.parse(file_data);
        } catch(err) {
            console.error(file_data);
            throw(err);
        }
        
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
        
//        console.log(setname + ': ' + util.formatThousands(this.data[setname].tweets_arr.length) + ' Tweets');
        triggers.emit('counters:count', setname);
    },
    countFeatures: function(setname) {
        var set = this.data[setname];
        
        if(!set) return;
        
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
        
        // Add up ngrams
        var repeatTextOK = this.ops['Display']['Filter'].is('none');
        for(; set.counted < set.tweets_arr.length; set.counted++) {
            var tweet = set.tweets_arr[set.counted];
            if(!tweet || typeof(tweet) != 'object') {
                this.abortLoadTweets(setname);
                continue;
            }
            
            var newTweetText = !set.counter['Tweet Based__Whole Text__Text Stripped'].has(tweet.TextStripped);

            if(repeatTextOK || newTweetText) { // Aggressive redundancy check
                set.nTweets += 1;
                
                // Add new features
                var domain = tweet['ExpandedURL'];
                if(domain) {
                    domain = domain.replace(
                        /.*:\/\/([^\/]*)(\/.*|$)/, '$1');
                }
                tweet['Expanded URL Domain'] = domain;
                
                // Get time feature
                var time = tweet['Timestamp'];
                time = util.date(time);
                time.setSeconds(0);
                time.setMilliseconds(0);
                time = time.getTime();
                tweet['Timestamp Minute'] = time;
                
                // Count features
                set.counter['Tweet Based__Categories__Type'].incr(tweet['Type']);
                set.counter['Tweet Based__Categories__Distinct'].incr(tweet['Distinct']);
                set.counter['Tweet Based__Whole Text__Text'].incr(tweet['Text']);
                set.counter['Tweet Based__Whole Text__Text Stripped'].incr(tweet['TextStripped']);
                set.counter['Tweet Based__Text Other__Language'].incr(util.subsetName({feature: 'Lang', match: tweet['Lang'].toLowerCase()}));
                set.counter['Tweet Based__Text Other__User Language'].incr(util.subsetName({feature: 'Lang', match: tweet['UserLang'].toLowerCase()}));
                set.counter['Tweet Based__Text Other__Using Pipe'].incr(tweet['Text'].includes('|') ? 1 : 0);
                set.counter['Tweet Based__URLs__Expanded URL Domain'].incr(tweet['Expanded URL Domain']);
                set.counter['Tweet Based__URLs__Expanded URL'].incr(tweet['ExpandedURL']);
                set.counter['Tweet Based__URLs__Media URL'].incr(tweet['MediaURL']);
                set.counter['Tweet Based__Origin__Screenname / User ID'].incr(tweet['Screenname'] + ' - ' + tweet['UserID']);
                set.counter['Tweet Based__Origin__Parent Tweet'].incr(tweet['ParentID']);
                set.counter['Tweet Based__Origin__Source'].incr(tweet['Source']);
                set.counter['Tweet Based__Temporal__Time Posted (PT)'].incr(tweet['Timestamp Minute']);
                set.counter['Tweet Based__Temporal__User\'s Timezone'].incr(tweet['UserTimezone']);
                
                
                // Count N-Grams
                var text = tweet.TextStripped.toLowerCase();
                text = text.replace(/[^\w']+/g, ' ');
                text = text.replace(/(\w)' /g, '$1 ').replace(/ '(\w)/g, ' $1');
                var words = text.split(' ');
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
                            if(words[wi + 2]) {
                                gram += " " + words[wi + 2];
                                set.counter['Tweet Based__Text N-Grams__Trigrams'].incr(gram);
                                if(!tweetgrams[2].has(gram)) {
                                    tweetgrams[2].add(gram);
//                                    ngrams.NGramHasCounter[2].incr(gram);
                                }
                            }
                        }
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
                });
            } // New Tweet or New URL
            
            // Remove the tweet object to save memory, will prevent other analysis but necessary for large datasets
//            set.tweets_arr[set.counted] = tweet.ID; // TODO
            
            var userscreenid = tweet['Screenname'] + ' - ' + tweet['UserID'];
            var newUser = set.counter['Tweet Based__Origin__Screenname / User ID'].get(userscreenid) == 1;
            
            if(newUser) {
                set.nUsers += 1;
                
                var creation = util.date(tweet['UserCreatedAt']);
                creation.setMilliseconds(0);
                creation.setSeconds(0);
                creation.setMinutes(0);
                creation.setHours(0);
                var firstTweet = util.twitterID2Timestamp(set.event.FirstTweet);
                var age = Math.floor((firstTweet.getTime() - creation.getTime()) / 24 / 60 / 60 / 1000);
            
                var user = {
                    ID: tweet['UserID'],
                    Tweets: 1,
                    Screenname: tweet['Screenname'],
                    Username: tweet['Username'],
                    CreatedAt: creation,
                    Age: age,
                    Description: tweet['UserDescription'],
                    LastTimeTweeted: util.date(tweet['Timestamp']).getTime(),
                    TweetIntervals: [],
                    MedianTweetInterval: 0,
                    MeanTweetInterval: 0,
                    DeviationTweetInterval: 0,
                    NormalDeviationTweetInterval: 0,
                    Location: tweet['UserLocation'],
                    UTCOffset: tweet['UserUTCOffset'],
                    Timezone: tweet['UserTimezone'],
                    Lang: tweet['UserLang'],
                    Verified: tweet['UserVerified'],
                    UsingPipe: tweet['Text'].includes('|') ? 1 : 0,
                    Statuses: { Start:parseInt(tweet['UserStatusesCount']), 
                               End:parseInt(tweet['UserStatusesCount']), Growth: 0},
                    Followers: { Start:parseInt(tweet['UserFollowersCount']), 
                               End:parseInt(tweet['UserFollowersCount']), Growth: 0},
                    Following: { Start:parseInt(tweet['UserFriendsCount']), 
                               End:parseInt(tweet['UserFriendsCount']), Growth: 0},
                    Listed: { Start:parseInt(tweet['UserListedCount']), 
                               End:parseInt(tweet['UserListedCount']), Growth: 0},
                    Favorites: { Start:parseInt(tweet['UserFavouritesCount']), 
                               End:parseInt(tweet['UserFavouritesCount']), Growth: 0},
                }
                set.users[user.ID] = user;
                
                set.counter['User Based__Identity__Username'].incr(user['Username']);
                set.counter['User Based__Identity__Lang'].incr(user['Lang']);
                set.counter['User Based__Identity__Verified'].incr(user['Verified']);
                set.counter['User Based__Activity__Tweets'].incr(user['Tweets']);
                set.counter['User Based__Activity__Median Interval Between Tweets'].not_applicable++;
                set.counter['User Based__Activity__Deviation Interval Between Tweets'].not_applicable++;
                set.counter['User Based__Activity__Normal Deviation Interval Between Tweets'].not_applicable++;
//                set.counter['User Based__Activity__Median Interval Between Tweets'].incr(user['MedianTweetInterval']);
                set.counter['User Based__Temporal__Account Creation Date'].incr(creation.getTime());
                set.counter['User Based__Temporal__Age of Account'].incr(age);
                set.counter['User Based__Localization__Location'].incr(user['Location']);
                set.counter['User Based__Localization__UTC Offset'].incr(user['UTCOffset']);
                set.counter['User Based__Localization__Timezone'].incr(user['Timezone']);
                set.counter['User Based__Tweet Text__Using Pipe'].incr(user['UsingPipe']);
                
                // User Description Unigrams
                var desc = (tweet.UserDescription || '').toLowerCase();
                var desc_words = desc.split(/\W/).filter(function(word) { return word.length > 0; });
                if(desc_words.length == 0) {
                    desc_words = [tweet.UserDescription];
                }
                desc_words.forEach(function(word) {
                    set.counter['User Based__Identity__Description Unigrams'].incr(word);
                });
                
                // Counts
                ['Statuses', 'Followers', 'Following', 'Listed', 'Favorites'].forEach(function(feature) {
                    set.counter['User Based__' + feature + '__Start'].incr(user[feature]['Start']);
                    set.counter['User Based__' + feature + '__Growth'].incr(user[feature]['Growth']);
                    set.counter['User Based__' + feature + '__Growth &ne; 0'].not_applicable++;
                });
            } else {
                var user = set.users[tweet.UserID];
                
                // Tweets
                set.counter['User Based__Activity__Tweets'].incr(user['Tweets'], -1);
                user['Tweets']++;
                set.counter['User Based__Activity__Tweets'].incr(user['Tweets']);
                
                // Median Interval between tweets
                var thisTimeTweeted = util.date(tweet['Timestamp']).getTime();
                var interval = (thisTimeTweeted - user['LastTimeTweeted']) / 60 / 1000;
                user['TweetIntervals'].push(interval);
                if(user['Tweets'] > 3) {
                    set.counter['User Based__Activity__Median Interval Between Tweets'].incr(user['MedianTweetInterval'], -1);
                    set.counter['User Based__Activity__Deviation Interval Between Tweets'].incr(user['DeviationTweetInterval'], -1);
                    set.counter['User Based__Activity__Normal Deviation Interval Between Tweets'].incr(user['NormalDeviationTweetInterval'], -1);
                } else if(user['Tweets'] == 3) {
                    set.counter['User Based__Activity__Median Interval Between Tweets'].incr(user['MedianTweetInterval'], -1);
                    set.counter['User Based__Activity__Deviation Interval Between Tweets'].not_applicable--;
                    set.counter['User Based__Activity__Normal Deviation Interval Between Tweets'].not_applicable--;
                } else if(user['Tweets'] == 2) {
                    set.counter['User Based__Activity__Median Interval Between Tweets'].not_applicable--;
                }
                user['MedianTweetInterval'] = d3.median(user['TweetIntervals']);
                user['MeanTweetInterval'] = d3.mean(user['TweetIntervals']);
                set.counter['User Based__Activity__Median Interval Between Tweets'].incr(user['MedianTweetInterval']);
                if(user['Tweets'] >= 3) {
                    user['DeviationTweetInterval'] = d3.deviation(user['TweetIntervals']);
                    user['NormalDeviationTweetInterval'] = user['DeviationTweetInterval'] / user['MeanTweetInterval'];
                    set.counter['User Based__Activity__Deviation Interval Between Tweets'].incr(user['DeviationTweetInterval']);
                    set.counter['User Based__Activity__Normal Deviation Interval Between Tweets'].incr(user['NormalDeviationTweetInterval']);
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
                user['Statuses']['End'] = parseInt(tweet['UserStatusesCount']);
                user['Followers']['End'] = parseInt(tweet['UserFollowersCount']);
                user['Following']['End'] = parseInt(tweet['UserFriendsCount']);
                user['Listed']['End'] = parseInt(tweet['UserListedCount']);
                user['Favorites']['End'] = parseInt(tweet['UserFavouritesCount']);
                
                // Insert new counts
                ['Statuses', 'Followers', 'Following', 'Listed', 'Favorites'].forEach(function(feature) {
                    user[feature]['Growth'] = user[feature]['End'] - user[feature]['Start'];
                    
                    set.counter['User Based__' + feature + '__Growth'].incr(user[feature]['Growth'], 1);
                    
                    if(user[feature]['Growth'] == 0) {
                        set.counter['User Based__' + feature + '__Growth &ne; 0'].not_applicable++;
                    } else {
                        set.counter['User Based__' + feature + '__Growth &ne; 0'].incr(user[feature]['Growth'], 1);
                    }
                });
            }
        }
        
        // Purge rare quantities from counters that take a LOT of memory
        if(set.counted > 1e6) {
            // Increased
            set.counter['Tweet Based__Text N-Grams__Co-Occur'].purgeBelow(10);
            set.counter['Tweet Based__Text N-Grams__Bigrams'].purgeBelow(5);
            set.counter['Tweet Based__Text N-Grams__Trigrams'].purgeBelow(5);
            
            // Old
//            set.counter['UserDescription Unigrams/User'].purgeBelow(2);
            
            // New
//            set.counter['Screenname'].purgeBelow(2);
//            set.counter['Username'].purgeBelow(2);
//            set.counter['UserID'].purgeBelow(2);
            
//            set.counter['Text'].purgeBelow(2);
//            set.counter['TextStripped'].purgeBelow(2);
//            set.counter['UserLocation'].purgeBelow(2);
//            set.counter['ParentID'].purgeBelow(2);
//            set.counter['TextUnigrams'].purgeBelow(2);
//            set.counter['ExpandedURL'].purgeBelow(2);
//            set.counter['MediaURL'].purgeBelow(2);
        } else {
            set.counter['Tweet Based__Text N-Grams__Co-Occur'].purgeBelow(5);
            set.counter['Tweet Based__Text N-Grams__Bigrams'].purgeBelow(2);
            set.counter['Tweet Based__Text N-Grams__Trigrams'].purgeBelow(2);
            
//            set.counter['UserDescription Unigrams'].purgeBelow(2);
        }
        
        triggers.emit('counters:place', setname);
    },
    placeCounts: function() {
        // Get appropriate set names
        var setname = this.dataset.subset ? 'subset ' + this.dataset.subset.ID : 
                                            'event '  + this.dataset.event.ID;
        var comparesetname = this.dataset.event2  ? 'event '  + this.dataset.event2.ID :
                             this.dataset.subset2 ? 'subset ' + this.dataset.subset2.ID : '';
        
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
        var cmp;
        if(comparesetname) {
            cmp = this.data[comparesetname];
            if(cmp) {
                this.desc_b.append('h3')
                    .html('Set B: ' + cmp.label);
                this.desc_b.append('h4')
                    .html(cmp.collection + ' ' + cmp.id);
                this.desc_b.append('p')
                    .html('Tweets: ' + cmp.counted);
            }
        }
        
        // Get parameters
        var n = parseInt(this.ops['Display']['TopX'].get());
        var excludeStopwords = this.ops['Display']['Exclude Stopwords'].is('true');
        var count_quantity = this.ops['Display']['Count Quantity'].get();
        var order_by = this.ops['Display']['Order'].get();
        var order_sign =  this.ops['Display']['Ascending'].is('asc') ? -1 : 1;
        if(order_by == 'Token') order_sign *= -1;
        var abs = false;
        if(order_by == 'Ratio Magnitude') {
            abs = true;
            order_by = 'Log Ratio';
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
        this.hierarchy_flatted.forEach(function(feature) {
            if(!feature.includes('Age of Account') &&
               !feature.includes('Start') &&
               !feature.includes('Growth') &&
               !feature.includes('Activity') &&
               !(feature.includes('User Based') && feature.includes('Using Pipe'))) {
                return;
            }
            
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
                        return formatted; 
                    } else {
                        return '';
                    }
                });
            
            // Show/hide comparison cells
            table.selectAll('.stat-cmp')
                .style('display', cmp ? 'table-cell' : 'none');
        }, this);
        
        // Add tables of counts
        this.hierarchy_flatted.forEach(function(feature) {
            var basis = feature.split(' ')[0];
            if(feature.includes('Age of Account') || // Don't count quantities
               feature.includes('Start') ||
               feature.includes('Growth') ||
               feature.includes('Activity') ||
              (feature.includes('User Based') && feature.includes('Using Pipe'))) {
                return;
            }
            
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
                    
                    if(count_quantity == 'freq') {
                        entry['Ratio']       = (entry['Frequency'] || 1e-5) / (entry['Frequency B'] || 1e-5);
                    } else {
                        entry['Ratio']       = (entry['Percent']   || 1e-5) / (entry['Percent B']   || 1e-5);
                    }
                    entry['Log Ratio']   = Math.log2(entry['Ratio']);
                }
                
                if(feature.includes('grams')) {
                    var words = token.split(' ');
                    var found = false;
                    var partially_found = false;
                    
                    // Check all keywords that they line up
                    set.event.Keywords.forEach(function(keyword) { 
                        var keyword_parts = keyword.split(' ');
                        var words_found = words.filter(function(word) {
                            return keyword_parts.includes(word);
                        });
                        found |= words.length == words_found.length && words.length == keyword_parts.length;
                        partially_found |= words_found.length > 0;
//                        console.log(words_found.length, keyword_parts.length, words_found.length == keyword_parts.length, words_found.length > 0, words, words_found, keyword_parts);
                    });
                    
                    // If perfect match return, otherwise check old keywords
                    if(found) {
                        entry['In Capture Keywords'] = 'Final Keyword';
                    } else {
                        set.event.OldKeywords.forEach(function(keyword) { 
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
                if(abs) {
                    if(Math.abs(a[order_by]) < Math.abs(b[order_by])) return  1 * order_sign;
                    if(Math.abs(a[order_by]) > Math.abs(b[order_by])) return -1 * order_sign;
                }
                if(a[order_by] < b[order_by]) return  1 * order_sign;
                if(a[order_by] > b[order_by]) return -1 * order_sign;
                if(a['Token']  < b['Token'] ) return  1 * order_sign;
                if(a['Token']  > b['Token'] ) return -1 * order_sign;
                return 0;
            });
            
            // Format Numbers
            entries.forEach(function(entry) {
                entry['Frequency'] = util.formatThousands(entry['Frequency']);
                entry['Percent']   = entry['Percent'].toFixed(1);
                if(cmp) {
//                    console.log(entry['Frequency'], entry['Frequency B'], entry['Ratio'], entry['Log Ratio']);
                    entry['Frequency B'] = util.formatThousands(entry['Frequency B']);
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
        }, this);
        
        triggers.emit('counters:show');
    },
    showCounts: function() {
        var count_quantity = this.ops['Display']['Count Quantity'].get();
        var cmp_quantity = this.ops['Display']['Cmp Quantity'].get();
        var comparesetname = this.dataset.event2  ? 'event '  + this.dataset.event2.ID :
                             this.dataset.subset2 ? 'subset ' + this.dataset.subset2.ID : '';
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
                if(count_quantity == 'freq')
                    return d['Frequency']; 
                return d['Percent']; 
            });
        
        if(cmp) {
            this.feature_divs.selectAll('.cell-cmp')
                .classed('cell-hidden', false);
            
            this.feature_divs.selectAll('tbody .freq-secondary')
                .html(function(d) { 
                    if(count_quantity == 'freq')
                        return d['Frequency B']; 
                    return d['Percent B']; 
                });
            this.feature_divs.selectAll('tbody .freq-cmp')
                .html(function(d) {
                    if(cmp_quantity == 'ratio')
                        return d['Ratio']; 
                    return d['Log Ratio'];
                });
        } else {
            this.feature_divs.selectAll('.cell-cmp')
                .classed('cell-hidden', true);
        }
    }
};

function initialize() {
    FD = new FeatureDistribution();
    
    FD.init();
}
window.onload = initialize;