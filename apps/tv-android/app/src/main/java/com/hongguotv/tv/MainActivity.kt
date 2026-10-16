package com.hongguotv.tv

import android.app.AlertDialog
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.hongguotv.tv.ui.*
import kotlinx.coroutines.*

/** TV owns its UI and library; styled according to Hongguo TV reference standard. */
@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
class MainActivity : ComponentActivity() {
    private val scope = MainScope()
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var history: HistorySync
    private lateinit var localContent: LocalContentService
    private var settingsStatus:TextView?=null
    private var settingsError:String?=null
    private var historySource = "all"
    private var historyRows = emptyList<Progress>()
    private var selectedHistory: Progress? = null
    private lateinit var store: TvStore
    private lateinit var artwork: ArtworkLoader
    private lateinit var root: FrameLayout
    private lateinit var backdrop: ImageView
    private lateinit var playerView: PlayerView

    // Scrims & Chrome
    private lateinit var scrimTopView: View
    private lateinit var scrimBottomView: View
    private lateinit var topHeader: LinearLayout
    private lateinit var topNavigation: HorizontalScrollView
    private val topNavigationButtons = mutableListOf<Button>()
    private var actionButtons = listOf<Button>()
    private lateinit var navigation: FrameLayout

    // Feed Overlay Elements (Styled according to PC/TV reference UI)
    private lateinit var feedOverlay: FrameLayout
    private lateinit var episodeBadge: TextView
    private lateinit var speedButton: Button
    private lateinit var qualityButton: Button
    private lateinit var infoTitle: TextView
    private lateinit var infoSubtitle: TextView
    private lateinit var infoTags: TextView
    private lateinit var infoDesc: TextView
    private lateinit var playButton: Button
    private lateinit var nextEpisodeButton: Button
    private lateinit var collectionButton: Button
    private lateinit var favButton: Button
    private lateinit var progressBox: LinearLayout
    private lateinit var timeText: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var pauseIndicator: View
    // Series id whose series-level text is currently rendered in the in-player overlay.
    // Switching episodes inside the same series only refreshes the badge/subtitle and keeps
    // the existing view tree, so no rebuild (removeAllViews) or artwork reload is needed.
    private var chromeSeriesId: String? = null

    // Center Seek HUD
    private lateinit var seekHud: LinearLayout
    private lateinit var seekHudDelta: TextView
    private lateinit var seekHudText: TextView
    private var accumulatedSeekDelta = 0L
    private var lastSeekTimestamp = 0L
    private val hideSeekHud = Runnable {
        seekHud.visibility = View.GONE
        accumulatedSeekDelta = 0L
        val isSwitching = ::switchHintView.isInitialized && switchHintView.visibility == View.VISIBLE
        if (player?.isPlaying == false && !overlayVisible && !isSwitching && dialog == null && (screen == Screen.FEED || screen == Screen.FULL)) {
            pauseIndicator.visibility = View.VISIBLE
        }
    }

    // Lightweight Switch Hint HUD
    private lateinit var switchHintView: SwitchHintView
    private val hideSwitchHintRunnable = Runnable {
        hideSwitchHint()
    }

    // In-Player Bottom Episode Drawer
    private lateinit var episodeDrawer: LinearLayout
    private lateinit var episodeDrawerTitle: TextView
    private lateinit var episodeDrawerGroupRow: LinearLayout
    private lateinit var episodeDrawerScroll: HorizontalScrollView
    private lateinit var episodeDrawerList: LinearLayout
    private var drawerEpisodeGroup = 0
    private val drawerEpisodeButtons = mutableListOf<Button>()

    private var player: ExoPlayer? = null
    private var foreground = false
    private var screen = Screen.FEED
    private var dialog: AlertDialog? = null
    private var overlayVisible = false
    private var activeDetail: Detail? = null
    private var activeIndex = 0
    private var feedMode = true
    private var savedPosition = 0L
    private var lastBackPressTime = 0L
    private var qualities = emptyList<Quality>()
    private var quality = "1080P"
    private var retryUsed = false
    private var playbackJob: Job? = null
    private var navigationJob: Job? = null
    private var feedJob: Job? = null
    private val playbackGeneration = GenerationGuard()
    private val navigationGeneration = GenerationGuard()
    private var feed = emptyList<Series>()
    private var feedIndex = 0
    private var feedPage = 0
    private var feedEnded = false
    private var feedSession=java.util.UUID.randomUUID().toString()
    private var feedModePreference="mixed"
    private var feedResetAt=0L
    private val feedPositions=mutableMapOf<String,Pair<Int,Long>>()
    private data class RecommendationRecord(val series:Series,val watch:RecommendationWatch=RecommendationWatch(),var exposures:Int=0,var skips:Int=0,var completed:Boolean=false,var skipped:Boolean=false)
    private val recommendationRecords=mutableMapOf<String,RecommendationRecord>()
    private var activeRecommendation:RecommendationRecord?=null
    private var lastRecommendationFlush=0L
    private var pendingFeedIndex: Int? = null
    private var pendingDetail: Pair<Series, Boolean>? = null
    private var pendingSeries: Series? = null
    private var resumePaused = false
    private var browsingDetail: Detail? = null
    private var detailOrigin = Screen.FEED
    private var episodeGroup = 0
    private var detailFocus = -1
    private var feedReturnPosition: Pair<Int, Long>? = null
    private var lastRecord: Progress? = null
    private var catalog = Catalog("", "")
    private var catalogScroll: android.os.Parcelable? = null
    private var catalogGrid: RecyclerView? = null
    private var currentCatalogView: CatalogScreenView? = null
    private var categoryTagScrollY = 0
    private var loadingCatalogMore = false
    private var loadCatalogMoreFailed = false
    private var selectedCategory = "real-drama"
    private var selectedTag = ""
    private var categoryTypes = emptyList<Pair<String, String>>()
    private var categoryTags = emptyList<Pair<String, String>>()
    private var categoryTagsType = ""
    private var categoryFilterFocus: String? = null
    private var selectedRank = "rank_hot"
    private val fallbackRankTypes = listOf(
        "rank_hot" to "红果热播榜",
        "rank_human" to "真人剧热播榜",
        "rank_comic" to "漫剧热播榜",
        "rank_ai" to "AI剧热播榜"
    )
    private var rankTypes = emptyList<Pair<String, String>>()
    private var searchQuery = ""
    private var lastSavedAt = 0L
    private var lastHistoryRefresh = 0L

    private enum class Screen { FEED, FULL, CATALOG, DETAIL, SETTINGS }
    private data class Catalog(val title: String, val source: String, var page: Int = 1,
                                var rows: List<Series> = emptyList(), var focusedId: String? = null,
                                var ended: Boolean = false)
    private fun repository() = TvRepository(getSharedPreferences("hongguotv_tv_v1", MODE_PRIVATE).getString("contentTestOrigin", null) ?: localContent.baseUrl)
    private fun dp(value: Int) = TvUi.dp(this, value)
    private fun dimen(@androidx.annotation.DimenRes id: Int) = TvUi.dimen(this, id)

    private fun focusPlayback(force: Boolean = false) {
        if (!force) {
            val hasUserFocus = (::topHeader.isInitialized && topHeader.findFocus() != null) ||
                               (::feedOverlay.isInitialized && feedOverlay.findFocus() != null)
            if (hasUserFocus) return
        }
        if (::playerView.isInitialized) {
            playerView.isFocusable = true
            playerView.isFocusableInTouchMode = true
            playerView.requestFocus()
        } else {
            root.requestFocus()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(window, false)
        androidx.core.view.WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(androidx.core.view.WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = androidx.core.view.WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        store = TvStore(this); history = HistorySync.get(this); localContent = LocalContentService(this); artwork = ArtworkLoader(scope)

        root = FrameLayout(this).apply {
            setBackgroundColor(TvUi.BACKGROUND)
            isFocusable = true; isFocusableInTouchMode = true
            descendantFocusability = ViewGroup.FOCUS_AFTER_DESCENDANTS
        }

        // 1. Ambient Blurred Backdrop
        backdrop = ImageView(this).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            alpha = 0.28f
        }
        root.addView(backdrop, FrameLayout.LayoutParams(-1, -1))

        // 2. Center 9:16 ExoPlayer View
        playerView = PlayerView(this).apply {
            useController = false
            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
            setShutterBackgroundColor(Color.TRANSPARENT)
            setBackgroundColor(Color.TRANSPARENT)
        }
        root.addView(playerView, FrameLayout.LayoutParams(-1, -1))

        // 3. Top & Bottom Natural Gradient Scrims
        scrimTopView = View(this).apply {
            background = TvUi.scrimTop()
        }
        root.addView(scrimTopView, FrameLayout.LayoutParams(-1, dimen(R.dimen.scrim_top_height), Gravity.TOP))

        scrimBottomView = View(this).apply {
            background = TvUi.scrimBottom()
        }
        root.addView(scrimBottomView, FrameLayout.LayoutParams(-1, dimen(R.dimen.scrim_bottom_height), Gravity.BOTTOM))

        // 4. Modern Header (Logo + Title + Subtitle + Nav Tabs + Settings)
        buildHeader()

        // 5. In-Player Full Reference Overlay
        buildFeedOverlay()

        // 6. Center Pause Indicator
        buildPauseIndicator()

        // 7. Center Seek HUD
        buildSeekHud()

        // 7.5 Lightweight Switch Hint HUD
        buildSwitchHintView()

        // 8. In-Player Bottom Episode Drawer
        buildEpisodeDrawer()

        // 9. Navigation Panels (Catalog / Detail / Settings)
        navigation = FrameLayout(this)
        root.addView(navigation, FrameLayout.LayoutParams(-1, -1))

        setContentView(root)
        focusPlayback()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = back()
        })
        this@MainActivity.handler.post(ticker)
        if (store.baseUrl.isNotBlank()) scope.launch { runCatching { history.migrate(store) } }
        when (intent?.getStringExtra("route")) {
            "rank" -> openCatalog("排行榜", "rank")
            "category" -> openCatalog("分类", "category")
            else -> startFeed()
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        when (intent.getStringExtra("route")) {
            "rank" -> openCatalog("排行榜", "rank")
            "category" -> openCatalog("分类", "category")
        }
    }

    private fun buildHeader() {
        val headerView = AppHeaderView(
            context = this,
            onFeedClick = { returnToFeed(autoplay = true) },
            onSearchClick = { showSearch() },
            onCategoryClick = { openCatalog("分类", "category") },
            onRankClick = { openCatalog("排行榜", "rank") },
            onFavoritesClick = { openCatalog("我的收藏", "favorites") },
            onHistoryClick = { openCatalog("观看历史", "history") },
            onSettingsClick = { showSettings() },
            onFocusChange = { _, focused ->
                if (focused && feedOverlay.visibility == View.VISIBLE) {
                    this@MainActivity.handler.removeCallbacks(hideChrome)
                    this@MainActivity.handler.postDelayed(hideChrome, 5000)
                }
            }
        )
        topHeader = headerView
        topNavigationButtons.clear()
        topNavigationButtons.addAll(headerView.topNavigationButtons)
        topNavigationButtons.forEach {
            it.isFocusable = true
            it.isFocusableInTouchMode = true
        }
        root.addView(topHeader, FrameLayout.LayoutParams(-1, dimen(R.dimen.header_height), Gravity.TOP))
    }

    private fun buildFeedOverlay() {
        val overlay = PlayerOverlay(
            context = this,
            onPlayClick = { btn ->
                if (player?.isPlaying == true) {
                    player?.pause()
                    resumePaused = true
                    btn.text = "继续播放"
                } else {
                    resumePaused = false
                    player?.play()
                    btn.text = "暂停播放"; overlayVisible = false; hideChromeNow()
                }
            },
            onNextEpisodeClick = {
                val detail = activeDetail
                if (detail != null && activeIndex + 1 < detail.episodes.size) {
                    saveProgress()
                    resumePaused = false
                    loadEpisode(activeIndex + 1)
                } else {
                    switchFeed(1, explicitNext = true)
                }
            },
            onCollectionClick = {
                if (activeDetail != null) {
                    showEpisodeDrawer()
                } else {
                    browsingDetail = activeDetail
                    detailOrigin = Screen.FEED
                    feedReturnPosition = activeIndex to (player?.currentPosition ?: savedPosition)
                    detailFocus = activeIndex % 50
                    episodeGroup = activeIndex / 50
                    showDetail()
                }
            },
            onFavClick = {
                activeDetail?.let {
                    store.toggleFavorite(it.series)
                    updateFavState()
                }
            },
            onSpeedClick = { chooseSpeed() },
            onQualityClick = { chooseQuality() },
            onFocusChange = { _, f ->
                if (f && feedOverlay.visibility == View.VISIBLE) {
                    this@MainActivity.handler.removeCallbacks(hideChrome)
                    this@MainActivity.handler.postDelayed(hideChrome, 5000)
                }
            }
        )
        feedOverlay = overlay
        episodeBadge = overlay.episodeBadge
        infoTitle = overlay.infoTitle
        infoSubtitle = overlay.infoSubtitle
        infoTags = overlay.infoTags
        infoDesc = overlay.infoDesc
        playButton = overlay.playButton
        nextEpisodeButton = overlay.nextEpisodeButton
        collectionButton = overlay.collectionButton
        favButton = overlay.favButton
        speedButton = overlay.speedButton
        qualityButton = overlay.qualityButton
        progressBox = overlay.progressBox
        timeText = overlay.timeText
        progressBar = overlay.progressBar

        val actions = listOf(playButton, nextEpisodeButton, collectionButton, favButton, speedButton, qualityButton)
        actionButtons = actions
        actions.forEach {
            it.isFocusable = true
            it.isFocusableInTouchMode = true
        }
        topNavigationButtons.forEachIndexed { index, navBtn ->
            val targetAction = when (index) {
                0, 1 -> playButton
                2 -> nextEpisodeButton
                3 -> collectionButton
                4 -> favButton
                5 -> speedButton
                else -> qualityButton
            }
            navBtn.nextFocusDownId = targetAction.id
        }
        actions.forEachIndexed { index, actionBtn ->
            val targetNav = when (index) {
                0 -> topNavigationButtons.getOrNull(0) ?: topNavigationButtons.first()
                1 -> topNavigationButtons.getOrNull(2) ?: topNavigationButtons.first()
                2 -> topNavigationButtons.getOrNull(3) ?: topNavigationButtons.first()
                3 -> topNavigationButtons.getOrNull(4) ?: topNavigationButtons.first()
                4 -> topNavigationButtons.getOrNull(5) ?: topNavigationButtons.first()
                else -> topNavigationButtons.getOrNull(6) ?: topNavigationButtons.last()
            }
            actionBtn.nextFocusUpId = targetNav.id
        }

        root.addView(feedOverlay, FrameLayout.LayoutParams(-1, -1))
        root.addView(progressBox, FrameLayout.LayoutParams(-1, -2).apply {
            gravity = Gravity.BOTTOM
            marginStart = dimen(R.dimen.indicator_margin_h)
            marginEnd = dimen(R.dimen.indicator_margin_h)
            bottomMargin = dimen(R.dimen.indicator_margin_bottom)
        })
    }

    private fun buildPauseIndicator() {
        pauseIndicator = CenterHudBuilder.buildPauseIndicator(this)
        root.addView(pauseIndicator, FrameLayout.LayoutParams(-2, -2, Gravity.CENTER))
    }

    private fun buildSeekHud() {
        val components = CenterHudBuilder.buildSeekHud(this)
        seekHud = components.layout
        seekHudDelta = components.deltaText
        seekHudText = components.timeText
        root.addView(seekHud, FrameLayout.LayoutParams(-2, -2, Gravity.CENTER))
    }

    private fun buildSwitchHintView() {
        switchHintView = SwitchHintView(this)
        val lp = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
        ).apply {
            bottomMargin = TvUi.dimen(this@MainActivity, R.dimen.switch_hint_margin_bottom)
        }
        root.addView(switchHintView, lp)
    }

    private fun showSwitchHint(title: String, subtitle: String? = null, badge: String? = null, loadingHint: String? = null) {
        handler.removeCallbacks(hideSwitchHintRunnable)
        if (::pauseIndicator.isInitialized) {
            pauseIndicator.visibility = View.GONE
        }
        if (::switchHintView.isInitialized) {
            switchHintView.show(title, subtitle, badge, loadingHint)
            handler.postDelayed(hideSwitchHintRunnable, 8000)
        }
    }

    private fun hideSwitchHint() {
        handler.removeCallbacks(hideSwitchHintRunnable)
        if (::switchHintView.isInitialized) {
            switchHintView.hide()
        }
    }

    private fun buildEpisodeDrawer() {
        val drawerView = EpisodeDrawerView(
            context = this,
            onDetailClick = {
                hideEpisodeDrawer(returnToMenu = false)
                browsingDetail = activeDetail
                detailOrigin = Screen.FEED
                feedReturnPosition = activeIndex to (player?.currentPosition ?: savedPosition)
                detailFocus = activeIndex % 50
                episodeGroup = activeIndex / 50
                showDetail()
            },
            onEpisodeSelected = { index ->
                saveProgress()
                resumePaused = false
                loadEpisode(index, 0L, true)
                hideEpisodeDrawer(returnToMenu = false)
            }
        )
        episodeDrawer = drawerView
        episodeDrawerTitle = drawerView.titleView
        episodeDrawerGroupRow = drawerView.groupTabsRow
        episodeDrawerScroll = drawerView.scrollView
        episodeDrawerList = drawerView.episodeListRow

        root.addView(episodeDrawer, FrameLayout.LayoutParams(-1, -2).apply {
            gravity = Gravity.BOTTOM
            marginStart = dimen(R.dimen.episode_drawer_margin_h)
            marginEnd = dimen(R.dimen.episode_drawer_margin_h)
            bottomMargin = dimen(R.dimen.episode_drawer_margin_bottom)
        })
    }

    private fun showEpisodeDrawer() {
        val detail = activeDetail ?: return
        drawerEpisodeGroup = activeIndex / 50
        renderEpisodeDrawer(detail)
        hideChromeNow()
        episodeDrawer.visibility = View.VISIBLE
        val targetOffset = activeIndex % 50
        val activeBtn = drawerEpisodeButtons.getOrNull(targetOffset)
        activeBtn?.requestFocus()
        activeBtn?.let { btn ->
            episodeDrawerScroll.post {
                episodeDrawerScroll.smoothScrollTo(btn.left - dimen(R.dimen.episode_drawer_scroll_offset), 0)
            }
        }
    }

    private fun hideEpisodeDrawer(returnToMenu: Boolean = true) {
        episodeDrawer.visibility = View.GONE
        if (returnToMenu) {
            revealChrome()
            collectionButton.requestFocus()
        } else {
            hideChromeNow()
            focusPlayback()
        }
    }

    private fun renderEpisodeDrawer(detail: Detail) {
        episodeDrawerTitle.text = "选集 · 《${detail.series.title}》 (全${detail.episodes.size}集)"

        // 1. Group tabs if episodes > 50
        episodeDrawerGroupRow.removeAllViews()
        val totalGroups = (detail.episodes.size + 49) / 50
        if (totalGroups > 1) {
            val groupMinHeight = dimen(R.dimen.episode_group_btn_min_height)
            val groupHeight = dimen(R.dimen.episode_group_btn_height)
            val groupPadH = dimen(R.dimen.episode_group_btn_pad_h)
            val groupPadV = dimen(R.dimen.episode_group_btn_pad_v)
            val groupMarginEnd = dimen(R.dimen.episode_group_btn_margin_end)

            for (g in 0 until totalGroups) {
                val start = g * 50 + 1
                val end = minOf((g + 1) * 50, detail.episodes.size)
                val isCurrentGroup = g == drawerEpisodeGroup
                val groupBtn = Button(this).apply {
                    text = "$start—$end"
                    textSize = 12f
                    isAllCaps = false
                    setTextColor(if (isCurrentGroup) Color.WHITE else TvUi.TEXT_MUTED)
                    background = TvUi.pillBackground(active = isCurrentGroup, radius = 20f)
                    minHeight = groupMinHeight
                    setPadding(groupPadH, groupPadV, groupPadH, groupPadV)
                    setOnClickListener {
                        drawerEpisodeGroup = g
                        renderEpisodeDrawer(detail)
                        drawerEpisodeButtons.firstOrNull()?.requestFocus()
                    }
                    setOnFocusChangeListener { v, f ->
                        v.scaleX = if (f) 1.06f else 1f
                        v.scaleY = if (f) 1.06f else 1f
                    }
                }
                episodeDrawerGroupRow.addView(groupBtn, LinearLayout.LayoutParams(-2, groupHeight).apply {
                    marginEnd = groupMarginEnd
                })
            }
        }

        // 2. Episodes list for drawerEpisodeGroup
        episodeDrawerList.removeAllViews()
        drawerEpisodeButtons.clear()
        val visible = detail.episodes.drop(drawerEpisodeGroup * 50).take(50)
        val itemMinHeight = dimen(R.dimen.episode_item_btn_min_height)
        val itemHeight = dimen(R.dimen.episode_item_btn_height)
        val itemPadH = dimen(R.dimen.episode_item_btn_pad_h)
        val itemPadV = dimen(R.dimen.episode_item_btn_pad_v)
        val itemMarginEnd = dimen(R.dimen.episode_item_btn_margin_end)

        visible.forEachIndexed { offset, episode ->
            val index = drawerEpisodeGroup * 50 + offset
            val isCurrent = index == activeIndex
            val btn = Button(this).apply {
                id = View.generateViewId()
                text = "${episode.number}"
                textSize = 14f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(if (isCurrent) Color.WHITE else 0xffcbd5e1.toInt())
                background = TvUi.pillBackground(active = isCurrent, radius = 12f)
                minHeight = itemMinHeight
                setPadding(itemPadH, itemPadV, itemPadH, itemPadV)
                setOnClickListener {
                    saveProgress()
                    resumePaused = false
                    loadEpisode(index, 0L, true)
                    hideEpisodeDrawer(returnToMenu = false)
                }
                setOnFocusChangeListener { v, f ->
                    v.scaleX = if (f) 1.08f else 1f
                    v.scaleY = if (f) 1.08f else 1f
                }
            }
            drawerEpisodeButtons.add(btn)
            episodeDrawerList.addView(btn, LinearLayout.LayoutParams(-2, itemHeight).apply {
                marginEnd = itemMarginEnd
            })
        }
    }

    private fun updateFavState() {
        val isFav = activeDetail?.let { store.isFavorite(it.series.id) } == true
        favButton.text = if (isFav) "♥ 已追" else "♥ 追剧"
        favButton.setTextColor(if (isFav) TvUi.RED else Color.WHITE)
        favButton.background = TvUi.pillBackground(active = false, radius = 24f)
    }

    override fun onStart() {
        super.onStart(); foreground = true; history.foreground(true)
        if(store.baseUrl.isNotBlank())scope.launch{runCatching{history.migrate(store)}}
        if (screen == Screen.FEED && pendingSeries != null) selectFeed(feedIndex)
        else if (activeDetail != null && player == null && (screen == Screen.FEED || screen == Screen.FULL)) loadEpisode(activeIndex, savedPosition, false, resetRetry = false)
        else if (screen == Screen.FEED && feed.isEmpty() && feedJob?.isActive != true) startFeed()
        if (screen == Screen.DETAIL && pendingDetail != null) pendingDetail?.let { openDetail(it.first, it.second, resumingLifecycle = true) }
        if (screen == Screen.CATALOG && catalog.rows.isEmpty() && navigationJob?.isActive != true && catalog.source !in listOf("favorites", "history")) loadCatalog(false)
    }
    override fun onStop() {
        hideSwitchHint()
        foreground=false
        updateRecommendationPlaying(false);flushRecommendation()
        foreground = false; history.foreground(false); resumePaused = true; saveProgress()
        playbackJob?.cancel(); playbackGeneration.next(); feedJob?.cancel()
        navigationJob?.cancel(); navigationGeneration.next()
        playerView.player = null; player?.release(); player = null
        super.onStop()
    }
    override fun onDestroy() {
        hideSwitchHint()
        this@MainActivity.handler.removeCallbacksAndMessages(null); dialog?.dismiss(); artwork.close(); scope.cancel()
        Thread({ localContent.close() }, "TV-content-close").apply { isDaemon=true; start() }
        super.onDestroy()
    }

    private val ticker = object : Runnable {
        override fun run() {
            updateRecommendationPlaying(player?.isPlaying==true&&foreground)
            if(android.os.SystemClock.elapsedRealtime()-lastRecommendationFlush>=10000)flushRecommendation()
            if(screen==Screen.SETTINGS)settingsStatus?.text=settingsError?:history.status
            player?.let { current ->
                val duration = current.duration.coerceAtLeast(0)
                timeText.text = "${TvUi.time(current.currentPosition)} / ${TvUi.time(duration)}"
                progressBar.progress = if (duration > 0) (current.currentPosition * 1000 / duration).toInt() else 0
                if (current.isPlaying && System.currentTimeMillis() - lastSavedAt >= 1000) saveProgress(flushSignals=false)
            }
            if (foreground && screen == Screen.CATALOG && catalog.source == "history" && navigationJob?.isActive != true && System.currentTimeMillis() - lastHistoryRefresh >= 1000) {
                lastHistoryRefresh = System.currentTimeMillis()
                val source = historySource
                val snapshot = catalog
                navigationJob = scope.launch {
                    try {
                        val rows = history.list(store.baseUrl, source)
                        if (screen == Screen.CATALOG && catalog === snapshot && historySource == source && rows != historyRows) {
                            val focus = (currentFocus as? Button)?.text?.toString()
                            catalogScroll = catalogGrid?.layoutManager?.onSaveInstanceState()
                            historyRows = rows; catalog.rows = rows.map { it.series }; renderCatalog(focus)
                        }
                    } catch (cancelled: CancellationException) { throw cancelled }
                    catch (_: Exception) { /* Keep last response visible */ }
                }
            }
            this@MainActivity.handler.postDelayed(this, 1000)
        }
    }

    private val hideProgressBox = Runnable {
        if (feedOverlay.visibility != View.VISIBLE) {
            progressBox.visibility = View.GONE
            scrimBottomView.visibility = View.GONE
        }
    }

    private fun hideChromeNow() {
        this@MainActivity.handler.removeCallbacks(hideChrome)
        this@MainActivity.handler.removeCallbacks(hideProgressBox)
        topHeader.visibility = View.GONE
        feedOverlay.visibility = View.GONE
        progressBox.visibility = View.GONE
        scrimTopView.visibility = View.GONE
        scrimBottomView.visibility = View.GONE
        focusPlayback(force = true)
    }

    private val hideChrome: Runnable = Runnable {
        if (!overlayVisible && dialog == null && (screen == Screen.FEED || screen == Screen.FULL)) {
            val focused = currentFocus
            val isNavFocused = (focused != null && focused != playerView && focused != root) ||
                               (::topHeader.isInitialized && topHeader.findFocus() != null) ||
                               (::feedOverlay.isInitialized && feedOverlay.findFocus() != null)
            if (isNavFocused) {
                this@MainActivity.handler.postDelayed(hideChrome, 5000)
            } else {
                hideChromeNow()
            }
        }
    }

    private fun revealChrome() {
        topHeader.visibility = if (screen == Screen.FEED) View.VISIBLE else View.GONE
        feedOverlay.visibility = if (screen == Screen.FEED || screen == Screen.FULL) View.VISIBLE else View.GONE
        progressBox.visibility = if (screen == Screen.FEED || screen == Screen.FULL) View.VISIBLE else View.GONE
        scrimTopView.visibility = View.VISIBLE
        scrimBottomView.visibility = View.VISIBLE
        this@MainActivity.handler.removeCallbacks(hideChrome)
        this@MainActivity.handler.removeCallbacks(hideProgressBox)
        this@MainActivity.handler.postDelayed(hideChrome, 5000)
    }

    private fun updateRecommendationPlaying(isPlaying:Boolean) {
        val record=activeRecommendation?:return
        val matches=record.series.id==activeDetail?.series?.id&&activeDetail?.episodes?.getOrNull(activeIndex)?.id==player?.currentMediaItem?.mediaId
        record.watch.update(android.os.SystemClock.elapsedRealtime(),isPlaying&&matches)
    }
    private fun flushRecommendation() {
        if(feedResetAt!=store.recommendationResetAt){activeRecommendation=null;return}
        val record=activeRecommendation?:return
        updateRecommendationPlaying(player?.isPlaying==true&&foreground)
        store.saveRecommendation(feedSession,record.series,record.watch.watchMs,record.exposures,record.skips,record.completed)
        lastRecommendationFlush=android.os.SystemClock.elapsedRealtime()
    }
    private fun activateRecommendation(series:Series) {
        activeRecommendation=recommendationRecords.getOrPut(series.id){RecommendationRecord(series)}.also{it.exposures++;it.skipped=false;it.watch.update(android.os.SystemClock.elapsedRealtime(),false)}
        flushRecommendation()
    }

    private fun saveProgress(completed: Boolean = false,flushSignals:Boolean=true) {
        if(flushSignals)flushRecommendation()
        val detail = activeDetail ?: return
        val episode = detail.episodes.getOrNull(activeIndex) ?: return
        val current = player ?: return
        if(current.playbackState==Player.STATE_IDLE)return
        if (!PlaybackPolicy.canSaveProgress(episode.id, current.currentMediaItem?.mediaId)) return
        savedPosition = player?.currentPosition ?: savedPosition
        val duration = player?.duration?.coerceAtLeast(0) ?: 0L
        val record = Progress(detail.series, episode.id, episode.number, savedPosition, duration,
            completed || current.playbackState == Player.STATE_ENDED, System.currentTimeMillis())
        if (lastRecord?.episodeId == record.episodeId && lastRecord?.positionMs == record.positionMs && lastRecord?.completed == record.completed) return
        try { history.save(record); lastRecord = record }
        catch (error: Exception) { message("历史记录保存失败：${error.message}") }
        lastSavedAt = System.currentTimeMillis()
    }

    private fun stopForNavigation(next: Screen) {
        hideSwitchHint()
        saveProgress(); player?.pause(); playbackJob?.cancel(); playbackGeneration.next()
        feedJob?.cancel()
        pendingFeedIndex = null; pendingDetail = null; pendingSeries = null
        screen = next; overlayVisible = false
        topHeader.visibility = View.GONE
        feedOverlay.visibility = View.GONE
        progressBox.visibility = View.GONE
        scrimTopView.visibility = View.GONE
        scrimBottomView.visibility = View.GONE
        pauseIndicator.visibility = View.GONE
        seekHud.visibility = View.GONE
        episodeDrawer.visibility = View.GONE
        currentCatalogView = null; navigationJob?.cancel(); navigationGeneration.next(); navigation.removeAllViews()
    }

    private fun ensurePlayer(): ExoPlayer {
        player?.let { return it }
        val dataSource=androidx.media3.datasource.DefaultHttpDataSource.Factory().setConnectTimeoutMs(10000).setReadTimeoutMs(120000)
        return ExoPlayer.Builder(this).setMediaSourceFactory(androidx.media3.exoplayer.source.DefaultMediaSourceFactory(this).setDataSourceFactory(dataSource)).build().also { current ->
            player = current; playerView.player = current
            current.setAudioAttributes(androidx.media3.common.AudioAttributes.DEFAULT, true)
            current.addListener(object : Player.Listener {
                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    updateRecommendationPlaying(isPlaying&&foreground)
                    if(!isPlaying)flushRecommendation()
                    playButton.text = if (isPlaying) "暂停播放" else "继续播放"
                    if (isPlaying) {
                        pauseIndicator.visibility = View.GONE
                        if (feedOverlay.visibility == View.VISIBLE) revealChrome()
                    } else {
                        saveProgress()
                        val isSwitching = ::switchHintView.isInitialized && switchHintView.visibility == View.VISIBLE
                        if ((screen == Screen.FEED || screen == Screen.FULL) && !overlayVisible && !isSwitching && dialog == null) {
                            pauseIndicator.visibility = View.VISIBLE
                        }
                    }
                }
                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_READY) {
                        hideSwitchHint()
                    }
                    if (playbackState == Player.STATE_ENDED) {
                        // Clearing/replacing a playlist also emits ENDED. Only the active media may complete.
                        val episode=activeDetail?.episodes?.getOrNull(activeIndex) ?: return
                        if(!PlaybackPolicy.canSaveProgress(episode.id,current.currentMediaItem?.mediaId))return
                        pauseIndicator.visibility = View.GONE
                        episodeEnded()
                    }
                }
                override fun onPlayerError(error: PlaybackException) {
                    hideSwitchHint()
                    pauseIndicator.visibility = View.GONE
                    if (!retryUsed) { retryUsed = true; loadEpisode(activeIndex, current.currentPosition, true, false) }
                    else playbackError("视频播放失败，可能是网络或设备解码不支持。")
                }
            })
        }
    }

    private fun loadEpisode(index: Int, position: Long = 0, autoplay: Boolean = true, resetRetry: Boolean = true, afterPrepare: (() -> Unit)? = null, showSwitchHint: Boolean = false) {
        val detail = activeDetail ?: return
        val episode = detail.episodes.getOrNull(index) ?: return
        playbackJob?.cancel(); val generation = playbackGeneration.next()
        if (resetRetry) retryUsed = false
        player?.pause(); player?.clearMediaItems(); activeIndex = index; savedPosition = position
        pauseIndicator.visibility = View.GONE

        // 切集（同一部剧）只更新会变化的集数徽标与副标题，保留既有视图树；
        // 仅当切换剧集（series 变化）时才刷新系列级字段、清空导航容器并重新加载封面。
        val seriesChanged = chromeSeriesId != detail.series.id
        chromeSeriesId = detail.series.id
        episodeBadge.text = "第 ${episode.number} 集"
        infoSubtitle.text = "第 ${episode.number} 集 · 《${detail.series.title}》 第 ${episode.number} 集"
        playButton.text = if (player?.isPlaying == true) "暂停播放" else "继续播放"
        if (seriesChanged) {
            // Update series-level In-Player Overlays
            infoTitle.text = "@${detail.series.title}  ${detail.series.badge}"
            val tagList = if (detail.series.tags.isNotBlank()) detail.series.tags.split("/").joinToString("  ") { "#${it.trim()}" } else "#短剧  #爆款"
            infoTags.text = "#短剧  $tagList"
            infoDesc.text = detail.series.description.ifBlank { "精彩短剧连播，高潮迭起，逆袭反转不停歇！" }
            collectionButton.text = "合集：${detail.series.title} | 全${detail.episodes.size}集 >"
            navigation.removeAllViews()
            artwork.load(detail.series.cover, backdrop)
        }
        updateFavState()

        if (showSwitchHint) {
            hideChromeNow()
            showSwitchHint(
                title = detail.series.title,
                subtitle = "第 ${episode.number} 集 · 《${detail.series.title}》",
                badge = detail.series.badge.ifBlank { "全${detail.episodes.size}集" }
            )
        } else {
            revealChrome()
        }
        if (!overlayVisible) focusPlayback()

        playbackJob = scope.launch {
            try {
                val api = repository()
                val available = api.qualities(episode.id, detail.series.id)
                ensureActive(); if (!playbackGeneration.isCurrent(generation)) return@launch
                qualities = available; quality = PlaybackPolicy.chooseQuality(available, store.quality).key
                qualityButton.text = available.firstOrNull { it.key==quality }?.label ?: quality
                speedButton.text = "${store.speed}x"
                if (!foreground) return@launch
                val current = ensurePlayer()
                current.setMediaItem(MediaItem.Builder().setMediaId(episode.id).setUri(api.streamUrl(episode.id, detail.series.id, quality)).build())
                current.seekTo(position); current.setPlaybackSpeed(store.speed)
                current.prepare(); current.playWhenReady = autoplay && !resumePaused && foreground && dialog == null && (screen == Screen.FEED || screen == Screen.FULL)
                if (!showSwitchHint) {
                    revealChrome()
                }
                afterPrepare?.invoke()
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) { if (playbackGeneration.isCurrent(generation)) playbackError(error.message ?: "内容加载失败") }
        }
    }

    private fun playbackError(message: String) {
        hideSwitchHint()
        if (!foreground) return
        player?.pause(); overlayVisible = true; revealChrome()
        infoSubtitle.text = message
        collectionButton.text = "重试加载"
        chromeSeriesId = null
        collectionButton.setOnClickListener {
            resumePaused = false; overlayVisible = false; loadEpisode(activeIndex, savedPosition)
        }
        collectionButton.requestFocus()
    }

    private fun episodeEnded() {
        val detail = activeDetail ?: return
        if(activeIndex==detail.episodes.lastIndex){activeRecommendation?.completed=true;flushRecommendation()}
        saveProgress(true)
        if (activeIndex + 1 < detail.episodes.size) loadEpisode(activeIndex + 1, showSwitchHint = true)
        else if (feedMode) switchFeed(1) else showRelated(detail.series)
    }

    private fun startFeed() {
        stopForNavigation(Screen.FEED); feedMode = true; feed = emptyList(); feedPage = 0; feedIndex = 0; feedEnded = false
        feedSession=java.util.UUID.randomUUID().toString();recommendationRecords.clear();activeRecommendation=null
        feedModePreference=store.recommendationMode;feedResetAt=store.recommendationResetAt;feedPositions.clear()
        feedJob?.cancel()
        feedJob = scope.launch {
            try {
                appendFeed(); if (feed.isEmpty()) throw IllegalStateException("推荐暂时为空")
                if (screen == Screen.FEED) selectFeed(0)
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) { feedError(error.message ?: "无法读取推荐") }
        }
    }

    private suspend fun appendFeed() {
        if (feedEnded) return
        val page = feedPage + 1
        val session=feedSession
        val rows = repository().recommend(page,session)
        kotlin.coroutines.coroutineContext.ensureActive()
        if(session!=feedSession)return
        val merged = PlaybackPolicy.mergeUnique(feed, rows)
        feedEnded = rows.isEmpty() || merged.size == feed.size
        feed = merged; feedPage = page
    }

    private fun selectFeed(index: Int) {
        if(feedModePreference!=store.recommendationMode||feedResetAt!=store.recommendationResetAt){startFeed();return}
        val series = feed.getOrNull(index) ?: return
        activeDetail?.let{detail->if(feedMode&&detail.series.id!=series.id)feedPositions[detail.series.id]=activeIndex to (player?.currentPosition?:savedPosition)}
        pendingFeedIndex = null
        pendingSeries = series
        saveProgress(); player?.pause(); screen = Screen.FEED; feedMode = true; feedIndex = index
        navigation.removeAllViews()
        pauseIndicator.visibility = View.GONE
        playbackJob?.cancel(); val generation = playbackGeneration.next()
        hideChromeNow()
        showSwitchHint(title = series.title, subtitle = "内容加载中...", badge = series.badge)
        playbackJob = scope.launch {
            try {
                val detail = repository().detail(series.id)
                ensureActive(); if (!playbackGeneration.isCurrent(generation)) return@launch
                val typed=detail.copy(series=detail.series.copy(contentType=series.contentType))
                pendingSeries = null; history.begin(store.baseUrl, typed.series); lastRecord = null; activeDetail = typed;activateRecommendation(typed.series)
                val previous=feedPositions[typed.series.id];loadEpisode(previous?.first?:0,previous?.second?:0,showSwitchHint = true)
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) { if (playbackGeneration.isCurrent(generation)) feedError(error.message ?: "剧集加载失败") }
        }
        if (feed.size - index <= 3 && !feedEnded && feedJob?.isActive != true) {
            feedJob = scope.launch {
                try { appendFeed() }
                catch (cancelled: CancellationException) { throw cancelled }
                catch (_: Exception) { }
                finally {
                    pendingFeedIndex?.let { requested ->
                        pendingFeedIndex = null
                        if (foreground && screen == Screen.FEED) {
                            if (requested < feed.size) selectFeed(requested) else feedError("下一页加载失败，请重新加载推荐")
                        }
                    }
                }
            }
        }
    }

    private fun switchFeed(delta: Int, explicitNext:Boolean=false) {
        flushRecommendation()
        if(explicitNext&&delta>0)activeRecommendation?.let{record->if(!record.skipped&&record.watch.isQuickSkip(true)){record.skips++;record.skipped=true;flushRecommendation()}}
        val index = (feedIndex + delta).coerceAtLeast(0)
        if (index < feed.size) { selectFeed(index); return }
        if (feedJob?.isActive == true) { pendingFeedIndex = index; return }
        feedJob = scope.launch {
            try {
                appendFeed()
                if (screen == Screen.FEED) {
                    if (index < feed.size) selectFeed(index) else feedError("已看完本次推荐，可刷新获取推荐")
                }
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) { feedError(error.message ?: "加载推荐失败") }
        }
    }

    private fun feedError(message: String) {
        hideSwitchHint()
        if (!foreground) return
        overlayVisible = true; revealChrome()
        infoTitle.text = "@红果短剧"
        infoSubtitle.text = message
        collectionButton.text = "重新加载推荐"
        chromeSeriesId = null
        collectionButton.setOnClickListener { startFeed() }
        collectionButton.requestFocus()
    }

    private fun choice(title: String, labels: List<String>, selected: Int = 0, action: (Int) -> Unit) {
        dialog?.dismiss()
        dialog = AlertDialog.Builder(this).setTitle(title).setSingleChoiceItems(labels.toTypedArray(), selected) { shown, index ->
            shown.dismiss(); action(index)
        }.setNegativeButton("返回", null).create().also { shown -> shown.setOnDismissListener { dialog = null }; shown.show() }
    }

    private fun chooseQuality() {
        if (qualities.isEmpty()) return
        val continuePlaying=player?.playWhenReady==true&&!resumePaused
        choice("播放画质", qualities.map { it.label }, qualities.indexOfFirst { it.key == quality }.coerceAtLeast(0)) { index ->
            store.quality = qualities[index].key
            val position = player?.currentPosition ?: savedPosition
            loadEpisode(activeIndex, position, continuePlaying)
        }
    }

    private fun chooseSpeed() {
        val speeds = listOf(.75f, 1f, 1.25f, 1.5f, 2f, 3f)
        choice("播放倍速", speeds.map { "${it}x" }, speeds.indexOf(store.speed).coerceAtLeast(0)) { index ->
            store.speed = speeds[index]
            player?.setPlaybackSpeed(store.speed)
            speedButton.text = "${store.speed}x"
        }
    }

    private fun panel(title: String): LinearLayout {
        navigation.removeAllViews()
        val column = TvUi.column(this).apply {
            setBackgroundColor(TvUi.BACKGROUND)
            setPadding(
                dimen(R.dimen.search_page_pad_h),
                dimen(R.dimen.search_page_pad_v),
                dimen(R.dimen.search_page_pad_h),
                dimen(R.dimen.search_page_pad_v)
            )
        }
        column.addView(TvUi.title(this, title)); navigation.addView(column, FrameLayout.LayoutParams(-1, -1)); return column
    }

    private fun returnToFeed(autoplay: Boolean = false) {
        stopForNavigation(Screen.FEED); feedMode = true; resumePaused = !autoplay
        if (feed.isEmpty()) startFeed()
        else if (activeDetail?.series?.id == feed.getOrNull(feedIndex)?.id) loadEpisode(activeIndex, savedPosition, autoplay)
        else selectFeed(feedIndex)
        revealChrome()
    }

    private fun showSearch() {
        stopForNavigation(Screen.CATALOG)
        navigation.removeAllViews()
        val searchView = SearchScreenView(
            context = this,
            initialQuery = searchQuery,
            recentQueries = store.searches(),
            onSearchSubmit = { query ->
                searchQuery = query
                store.saveSearch(query)
                openCatalog("搜索：$query", "search")
            }
        )
        navigation.addView(searchView, FrameLayout.LayoutParams(-1, -1))
        searchView.input.requestFocus()
    }

    private fun openCatalog(title: String, source: String) {
        stopForNavigation(Screen.CATALOG); catalog = Catalog(title, source); catalogScroll = null
        categoryFilterFocus = null
        loadingCatalogMore = false
        loadCatalogMoreFailed = false
        if (source == "favorites") { catalog.rows = store.favorites(); catalog.ended = true; renderCatalog() }
        else if (source == "history") { selectedHistory = null; loadHistory() }
        else loadCatalog(false)
    }

    private fun sourceLabel(source: String) = when (source) { "web" -> "Web"; "pc" -> "电脑"; else -> "电视" }

    private fun loadHistory() {
        navigationJob?.cancel(); val generation = navigationGeneration.next(); val source = historySource
        panel("观看历史").addView(TvUi.text(this, "正在读取共享历史…"))
        navigationJob = scope.launch {
            try {
                history.migrate(store)
                val rows = history.list(store.baseUrl, source)
                ensureActive(); if (screen != Screen.CATALOG || catalog.source != "history" || !navigationGeneration.isCurrent(generation)) return@launch
                historyRows = rows; catalog.rows = rows.map { it.series }; catalog.ended = true; renderCatalog()
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) {
                if (!navigationGeneration.isCurrent(generation)) return@launch
                val column = panel("观看历史"); column.addView(TvUi.text(this@MainActivity, "无法读取后端历史：${error.message}"))
                column.addView(TvUi.button(this@MainActivity, "重试") { loadHistory() }.apply { requestFocus() })
            }
        }
    }

    private fun loadCatalog(nextPage: Boolean) {
        if (navigationJob?.isActive == true || (nextPage && catalog.ended)) {
            return
        }
        if (!nextPage) {
            loadingCatalogMore = false
            loadCatalogMoreFailed = false
        }
        val generation = navigationGeneration.next(); val snapshot = catalog
        if (!nextPage && navigation.childCount == 0) panel(snapshot.title).addView(TvUi.text(this, "加载中…"))
        navigationJob = scope.launch {
            try {
                val api = repository(); val page = if (nextPage) snapshot.page + 1 else 1
                if (snapshot.source == "category") {
                    if (categoryTypes.isEmpty()) categoryTypes = api.categoryTypes()
                    if (categoryTagsType!=selectedCategory) {
                        categoryTags=api.categoryTags(selectedCategory)
                        categoryTagsType=selectedCategory
                    }
                }
                if (snapshot.source == "rank") {
                    if (rankTypes.isEmpty()) {
                        rankTypes = runCatching { api.rankTypes() }.getOrDefault(fallbackRankTypes)
                        if (rankTypes.isEmpty()) rankTypes = fallbackRankTypes
                    }
                    if (rankTypes.none { it.first == selectedRank }) {
                        selectedRank = rankTypes.firstOrNull()?.first ?: "hot-drama"
                    }
                }
                var officialLastPage=0
                val rows = when (snapshot.source) {
                    "search" -> api.search(searchQuery, page)
                    "category" -> api.categoryPage(selectedCategory, selectedTag, page).also{officialLastPage=it.totalPages}.items
                    "rank" -> api.rank(selectedRank, page)
                    "related" -> api.related(browsingDetail?.series?.id ?: activeDetail!!.series.id, page)
                    else -> emptyList()
                }
                ensureActive(); if (!navigationGeneration.isCurrent(generation) || screen != Screen.CATALOG) return@launch
                val merged = if (nextPage) PlaybackPolicy.mergeUnique(snapshot.rows, rows) else rows
                snapshot.ended = rows.isEmpty() || (nextPage && merged.size == snapshot.rows.size) || (snapshot.source == "category" && officialLastPage>0 && page>=officialLastPage) || (snapshot.source == "rank" && page >= 5)
                val newItems = if (nextPage) merged.drop(snapshot.rows.size) else rows
                snapshot.rows = merged; snapshot.page = page
                loadingCatalogMore = false
                loadCatalogMoreFailed = false
                currentCatalogView?.setLoadingMore(false)
                if (nextPage && currentCatalogView != null && screen == Screen.CATALOG && currentCatalogView?.source == snapshot.source) {
                    currentCatalogView?.appendRows(newItems)
                } else {
                    renderCatalog()
                }
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) {
                loadingCatalogMore = false
                currentCatalogView?.setLoadingMore(false)
                if (nextPage) {
                    loadCatalogMoreFailed = true
                }
                if (navigationGeneration.isCurrent(generation)) {
                    val column = panel(snapshot.title); column.addView(TvUi.text(this@MainActivity, error.message ?: "加载失败"))
                    column.addView(TvUi.button(this@MainActivity, "重试") { navigationJob = null; loadCatalogMoreFailed = false; loadCatalog(nextPage) }.apply { requestFocus() })
                }
            }
        }
    }

    private fun renderCatalog(preserveFocus: String? = null) {
        screen = Screen.CATALOG
        currentCatalogView?.tagScrollView?.let { categoryTagScrollY = it.scrollY }
        navigation.removeAllViews()

        val catalogView = CatalogScreenView(
            context = this,
            title = catalog.title,
            source = catalog.source,
            rows = catalog.rows,
            selectedCategory = selectedCategory,
            selectedTag = selectedTag,
            categoryTypes = categoryTypes,
            categoryTags = categoryTags,
            categoryFilterFocus = categoryFilterFocus,
            rankTypes = rankTypes,
            selectedRank = selectedRank,
            artwork = artwork,
            onFilterSelected = { key, kind, id ->
                categoryFilterFocus = key
                if (kind == "type") {
                    selectedCategory = id
                    selectedTag = ""
                    categoryTagScrollY = 0
                } else {
                    selectedTag = id
                }
                catalog.page = 1; catalog.focusedId = null; catalogScroll = null
                catalog.ended = false
                loadingCatalogMore = false
                loadCatalogMoreFailed = false
                navigationJob = null; loadCatalog(false)
            },
            onRankSelected = { slug ->
                if (slug != selectedRank) {
                    selectedRank = slug
                    catalog.page = 1
                    catalog.focusedId = null
                    catalogScroll = null
                    catalog.ended = false
                    loadingCatalogMore = false
                    loadCatalogMoreFailed = false
                    navigationJob = null
                    loadCatalog(false)
                }
            },
            onRefreshHistory = { loadHistory() },
            onReturnFeed = { returnToFeed() },
            onSeriesClick = { series, manager ->
                catalogScroll = manager.onSaveInstanceState()
                if (catalog.source == "history") {
                    selectedHistory = historyRows.firstOrNull { it.series.id == series.id }
                    openDetail(series, resumeImmediately = true)
                } else {
                    selectedHistory = null
                    openDetail(series)
                }
            },
            onSeriesFocused = { series -> catalog.focusedId = series.id },
            onSubtitleProvider = { series ->
                if (catalog.source == "history") {
                    historyRows.firstOrNull { it.series.id == series.id }?.let {
                        "第 ${it.episodeNumber} 集 · ${TvUi.time(it.positionMs)}\n${java.text.DateFormat.getDateTimeInstance(java.text.DateFormat.SHORT, java.text.DateFormat.SHORT).format(java.util.Date(it.updatedAt))}"
                    } ?: series.badge
                } else series.badge
            },
            onProgressProvider = { series ->
                if (catalog.source == "history") {
                    historyRows.firstOrNull { it.series.id == series.id }?.let {
                        if (it.durationMs > 0) it.positionMs.toFloat() / it.durationMs else 0f
                    }
                } else null
            },
            onNearBottom = { triggerAutoPage() },
            initialTagScrollY = categoryTagScrollY
        )

        currentCatalogView = catalogView
        catalogGrid = catalogView.gridView
        val manager = catalogView.manager

        navigation.addView(catalogView, FrameLayout.LayoutParams(-1, -1))

        if (catalog.rows.isNotEmpty() && manager != null) {
            val grid = catalogView.gridView ?: return
            val index = PlaybackPolicy.restoredIndex(catalog.rows, catalog.focusedId)
            if (catalogScroll != null) manager.onRestoreInstanceState(catalogScroll) else grid.scrollToPosition(index)
            grid.post {
                val filter = catalogView.categoryButtons.firstOrNull { it.contentDescription == categoryFilterFocus }
                val rankBtn = if (catalog.source == "rank" && catalog.focusedId == null) {
                    catalogView.rankButtons.firstOrNull { it.isSelected } ?: catalogView.rankButtons.firstOrNull()
                } else null
                val tool = (0 until catalogView.tools.childCount).map { catalogView.tools.getChildAt(it) }.filterIsInstance<Button>()
                    .firstOrNull { preserveFocus != null && it.text.toString().removePrefix("● ") == preserveFocus.removePrefix("● ") }
                filter?.requestFocus() ?: rankBtn?.requestFocus() ?: tool?.requestFocus() ?: (manager.findViewByPosition(index)?.requestFocus() ?: grid.requestFocus())
            }
        }
    }

    private fun triggerAutoPage() {
        if (catalog.ended || navigationJob?.isActive == true || loadingCatalogMore || loadCatalogMoreFailed) {
            return
        }
        val manager = catalogGrid?.layoutManager as? GridLayoutManager ?: return
        val total = manager.itemCount
        val lastVisible = manager.findLastVisibleItemPosition()
        if (total <= 0 || lastVisible < total - 5) {
            return
        }
        loadingCatalogMore = true
        currentCatalogView?.setLoadingMore(true)
        loadCatalog(nextPage = true)
    }

    private fun loadChoices(title: String, fetch: suspend () -> List<Pair<String, String>>, selected: (String) -> Unit) {
        navigationJob?.cancel(); val generation = navigationGeneration.next(); val source = catalog
        navigationJob = scope.launch {
            try {
                val rows = fetch()
                if (screen == Screen.CATALOG && catalog === source && navigationGeneration.isCurrent(generation)) {
                    choice(title, rows.map { it.second }) { index -> selected(rows[index].first) }
                }
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) { if (screen == Screen.CATALOG) message(error.message ?: "加载失败") }
        }
    }

    private fun openDetail(series: Series, resumeImmediately: Boolean = false, resumingLifecycle: Boolean = false) {
        detailOrigin = Screen.CATALOG; stopForNavigation(Screen.DETAIL); episodeGroup = 0; detailFocus = -1
        pendingDetail = series to resumeImmediately
        val generation = navigationGeneration.next()
        panel(series.title).addView(TvUi.text(this, "正在读取分集…"))
        navigationJob = scope.launch {
            try {
                val detail = repository().detail(series.id)
                ensureActive(); if (!navigationGeneration.isCurrent(generation) || screen != Screen.DETAIL) return@launch
                pendingDetail = null
                browsingDetail = detail
                if (resumeImmediately) playDetail(resume = true, autoplay = !resumingLifecycle) else showDetail()
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) {
                val column = panel(series.title); column.addView(TvUi.text(this@MainActivity, error.message ?: "加载失败"))
                column.addView(TvUi.button(this@MainActivity, "重试") { openDetail(series, resumeImmediately) }.apply { requestFocus() })
            }
        }
    }

    private fun showDetail() {
        val detail = browsingDetail ?: activeDetail ?: return
        browsingDetail = detail
        stopForNavigation(Screen.DETAIL)
        navigation.removeAllViews()

        val detailView = DetailScreenView(
            context = this,
            detail = detail,
            isFavorite = store.isFavorite(detail.series.id),
            activeIndex = activeIndex,
            episodeGroup = episodeGroup,
            detailFocus = detailFocus,
            artwork = artwork,
            onPlayFromStart = { playDetail(false) },
            onResumePlay = { playDetail(true) },
            onToggleFavorite = {
                store.toggleFavorite(detail.series)
                showDetail()
            },
            onGroupChanged = { g ->
                episodeGroup = g
                detailFocus = 0
                showDetail()
            },
            onEpisodeSelected = { focus, episodeIndex ->
                detailFocus = focus
                playDetail(false, episodeIndex)
            }
        )

        navigation.addView(detailView, FrameLayout.LayoutParams(-1, -1))
        detailView.focusTargetView?.requestFocus()
    }

    private fun playDetail(resume: Boolean, selectedIndex: Int? = null, autoplay: Boolean = true) {
        val detail = browsingDetail ?: return
        if (resume && selectedHistory?.series?.id != detail.series.id) {
            val generation = navigationGeneration.next()
            navigationJob = scope.launch {
                try {
                    val record = history.progress(store.baseUrl, detail.series.id)
                    ensureActive()
                    if (screen != Screen.DETAIL || browsingDetail?.series?.id != detail.series.id || !navigationGeneration.isCurrent(generation)) return@launch
                    selectedHistory = record; playDetailWithRecord(detail, record, selectedIndex, autoplay)
                } catch (cancelled: CancellationException) { throw cancelled }
                catch (error: Exception) { message("无法读取共享历史：${error.message}") }
            }
            return
        }
        val record = if (resume) selectedHistory else null
        playDetailWithRecord(detail, record, selectedIndex, autoplay)
    }

    private fun playDetailWithRecord(detail: Detail, record: Progress?, selectedIndex: Int?, autoplay: Boolean) {
        stopForNavigation(Screen.FULL)
        selectedHistory = null
        history.begin(store.baseUrl, detail.series); lastRecord = null
        activeDetail = detail; feedMode = false; resumePaused = !autoplay
        activateRecommendation(detail.series)
        val index = selectedIndex ?: if (record != null) PlaybackPolicy.resumeIndex(detail.episodes, record) else 0
        val position = if (record != null && !record.completed && detail.episodes.getOrNull(index)?.id == record.episodeId) record.positionMs else 0L
        loadEpisode(index, position, autoplay)
    }

    private fun showRelated(series: Series) {
        browsingDetail = activeDetail; openCatalog("已看完《${series.title}》· 猜你喜欢", "related")
    }

    private fun showSettings() {
        stopForNavigation(Screen.SETTINGS)
        settingsError = null
        navigation.removeAllViews()

        val settingsView = SettingsScreenView(
            context = this,
            history = history,
            store = store,
            onConnectClick = { url, key, statusView ->
                navigationJob?.cancel()
                val generation = navigationGeneration.next()
                navigationJob = scope.launch {
                    try {
                        settingsError = null
                        statusView.text = "正在检查远程服务…"
                        history.configure(url, key)
                        ensureActive()
                        if (!navigationGeneration.isCurrent(generation)) return@launch
                        statusView.text = history.status
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (error: Exception) {
                        settingsError = "连接失败：${error.message ?: "原配置已保留"}"
                        statusView.text = settingsError
                    }
                }
            },
            onDisableSyncClick = { urlEdit, keyEdit, statusView ->
                scope.launch {
                    history.disable()
                    urlEdit.setText("")
                    keyEdit.setText("")
                    statusView.text = history.status
                }
            },
            onChooseModeClick = {
                val modeNames = arrayOf("混合推荐", "真人剧", "漫剧", "AI剧")
                val modes = listOf("mixed", "real-drama", "comic-drama", "ai-drama")
                dialog = AlertDialog.Builder(this)
                    .setTitle("推荐内容")
                    .setSingleChoiceItems(modeNames, modes.indexOf(store.recommendationMode).coerceAtLeast(0)) { d, index ->
                        store.recommendationMode = modes[index]
                        d.dismiss()
                        dialog = null
                        startFeed()
                    }
                    .create()
                    .also {
                        it.setOnDismissListener { dialog = null }
                        it.show()
                    }
            },
            onResetPreferencesClick = {
                confirm("重置推荐兴趣？观看历史和收藏会保留。") {
                    store.resetRecommendationPreferences()
                    startFeed()
                }
            }
        )

        settingsStatus = settingsView.statusText
        navigation.addView(settingsView, FrameLayout.LayoutParams(-1, -1))
        settingsView.urlInput.requestFocus()
    }

    private fun message(value: String) { dialog = AlertDialog.Builder(this).setMessage(value).setPositiveButton("确定", null).create().also { it.setOnDismissListener { dialog = null }; it.show() } }
    private fun confirm(value: String, yes: () -> Unit) {
        dialog?.dismiss(); dialog = AlertDialog.Builder(this).setMessage(value).setPositiveButton("确定") { _, _ -> yes() }.setNegativeButton("取消", null).create().also { it.setOnDismissListener { dialog = null }; it.show() }
    }

    private fun back() {
        if (dialog != null) { dialog?.dismiss(); return }
        if (::episodeDrawer.isInitialized && episodeDrawer.visibility == View.VISIBLE) {
            hideEpisodeDrawer(returnToMenu = true)
            return
        }
        when (screen) {
            Screen.FULL -> {
                if (feedOverlay.visibility == View.VISIBLE) {
                    hideChromeNow()
                } else {
                    showDetail()
                }
            }
            Screen.DETAIL -> if (detailOrigin == Screen.CATALOG) { stopForNavigation(Screen.CATALOG); renderCatalog() } else {
                screen = detailOrigin; feedMode = screen == Screen.FEED; navigation.removeAllViews()
                val restore = feedReturnPosition
                loadEpisode(restore?.first ?: activeIndex, restore?.second ?: savedPosition, false)
            }
            Screen.CATALOG, Screen.SETTINGS -> returnToFeed()
            Screen.FEED -> {
                val now = System.currentTimeMillis()
                if (feedOverlay.visibility == View.VISIBLE) {
                    // 在菜单显示时按返回按钮是隐藏菜单
                    hideChromeNow(); lastBackPressTime = now
                    Toast.makeText(this, "再按一次返回键退出应用", Toast.LENGTH_SHORT).show()
                } else {
                    // 菜单隐藏时：若在刚隐藏后 2.5 秒内再次按返回，则退出应用；否则呼出菜单
                    if (now - lastBackPressTime < 2500L) {
                        resumePaused = true
                        player?.pause()
                        saveProgress()
                        finish()
                    } else {
                        revealChrome()
                        collectionButton.post { collectionButton.requestFocus() }
                    }
                }
            }
        }
    }

    private fun switchFullEpisode(direction: Int, repeatCount: Int) {
        if (repeatCount != 0) return
        val detail = activeDetail ?: return
        val index = PlaybackPolicy.remoteEpisodeIndex(activeIndex, detail.episodes.size, direction, repeatCount)
        if (index == null) {
            Toast.makeText(this, if (direction < 0) "已经是第一集" else "已经是最后一集", Toast.LENGTH_SHORT).show()
            return
        }
        saveProgress()
        resumePaused = false
        loadEpisode(index, showSwitchHint = true)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (dialog != null || (screen != Screen.FEED && screen != Screen.FULL)) return super.onKeyDown(keyCode, event)
        return when (keyCode) {
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_SPACE -> {
                if (::episodeDrawer.isInitialized && episodeDrawer.visibility == View.VISIBLE) {
                    if (currentFocus != null && currentFocus != episodeDrawer) {
                        currentFocus?.performClick()
                    }
                    true
                } else if (feedOverlay.visibility != View.VISIBLE) {
                    player?.let { current ->
                        if (current.isPlaying) {
                            current.pause()
                            resumePaused = true
                            saveProgress()
                            pauseIndicator.visibility = View.VISIBLE
                        } else {
                            resumePaused = false
                            current.play()
                            pauseIndicator.visibility = View.GONE
                        }
                    }
                    true
                } else {
                    if (currentFocus == null || currentFocus == root || currentFocus == playerView) {
                        resumePaused = true; player?.pause(); saveProgress(); playButton.requestFocus()
                        true
                    } else {
                        currentFocus?.performClick() ?: false
                        true
                    }
                }
            }
            KeyEvent.KEYCODE_MENU -> {
                if (::episodeDrawer.isInitialized && episodeDrawer.visibility == View.VISIBLE) {
                    hideEpisodeDrawer(returnToMenu = true)
                    true
                } else if (feedOverlay.visibility == View.VISIBLE) {
                    hideChromeNow()
                    true
                } else {
                    hideSwitchHint()
                    revealChrome()
                    collectionButton.post {
                        collectionButton.requestFocus()
                    }
                    true
                }
            }
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> {
                resumePaused = false
                player?.let { current ->
                    if (current.isPlaying) {
                        current.pause()
                        resumePaused = true
                    } else {
                        current.play()
                    }
                }
                true
            }
            KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_DPAD_RIGHT -> {
                if (::episodeDrawer.isInitialized && episodeDrawer.visibility == View.VISIBLE) {
                    super.onKeyDown(keyCode, event)
                } else if (feedOverlay.visibility != View.VISIBLE) {
                    player?.let { current ->
                        val now = System.currentTimeMillis()
                        val step = 10000L
                        val delta = if (keyCode == KeyEvent.KEYCODE_DPAD_LEFT) -step else step
                        if (now - lastSeekTimestamp < 1200L) {
                            accumulatedSeekDelta += delta
                        } else {
                            accumulatedSeekDelta = delta
                        }
                        lastSeekTimestamp = now

                        val targetPos = PlaybackPolicy.seek(current.currentPosition, delta, current.duration)
                        current.seekTo(targetPos)
                        saveProgress()

                        val duration = current.duration.coerceAtLeast(0)
                        val totalSec = accumulatedSeekDelta / 1000
                        val sign = if (totalSec > 0) "+$totalSec" else "$totalSec"
                        val arrow = if (totalSec > 0) "▶▶" else "◀◀"
                        seekHudDelta.text = "$arrow ${sign}s"
                        seekHudDelta.setTextColor(if (totalSec > 0) TvUi.AMBER else 0xff38bdf8.toInt())
                        seekHudText.text = "${TvUi.time(targetPos)} / ${TvUi.time(duration)}"

                        pauseIndicator.visibility = View.GONE
                        seekHud.visibility = View.VISIBLE

                        timeText.text = "${TvUi.time(targetPos)} / ${TvUi.time(duration)}"
                        progressBar.progress = if (duration > 0) (targetPos * 1000 / duration).toInt() else 0
                        progressBox.visibility = View.VISIBLE
                        scrimBottomView.visibility = View.VISIBLE

                        this@MainActivity.handler.removeCallbacks(hideSeekHud)
                        this@MainActivity.handler.postDelayed(hideSeekHud, 1200)

                        this@MainActivity.handler.removeCallbacks(hideProgressBox)
                        this@MainActivity.handler.postDelayed(hideProgressBox, 1500)
                    }
                    true
                } else {
                    // 屏幕菜单显示时：遥控器左右按键不再控制进度条，仅用于菜单/按钮切换
                    this@MainActivity.handler.removeCallbacks(hideChrome)
                    this@MainActivity.handler.postDelayed(hideChrome, 5000)
                    if (currentFocus == null || currentFocus == root || currentFocus == playerView) {
                        collectionButton.post { collectionButton.requestFocus() }
                        true
                    } else {
                        super.onKeyDown(keyCode, event)
                    }
                }
            }
            KeyEvent.KEYCODE_DPAD_UP -> {
                if (::episodeDrawer.isInitialized && episodeDrawer.visibility == View.VISIBLE) {
                    super.onKeyDown(keyCode, event)
                } else if (feedOverlay.visibility == View.VISIBLE) {
                    this@MainActivity.handler.removeCallbacks(hideChrome)
                    this@MainActivity.handler.postDelayed(hideChrome, 5000)
                    val actionIdx = actionButtons.indexOf(currentFocus)
                    if (actionIdx != -1) {
                        val targetNav = when (actionIdx) {
                            0 -> topNavigationButtons.getOrNull(0) ?: topNavigationButtons.first()
                            1 -> topNavigationButtons.getOrNull(1) ?: topNavigationButtons.first()
                            2 -> topNavigationButtons.getOrNull(2) ?: topNavigationButtons.first()
                            3 -> topNavigationButtons.getOrNull(3) ?: topNavigationButtons.first()
                            4 -> topNavigationButtons.getOrNull(4) ?: topNavigationButtons.first()
                            else -> topNavigationButtons.getOrNull(6) ?: topNavigationButtons.last()
                        }
                        targetNav.requestFocus()
                        true
                    } else if (currentFocus == null || currentFocus == root || currentFocus == playerView) {
                        val target = topNavigationButtons.firstOrNull() ?: collectionButton
                        target.post { target.requestFocus() }
                        true
                    } else {
                        super.onKeyDown(keyCode, event)
                    }
                } else {
                    if (event.repeatCount == 0 && feedMode) {
                        resumePaused = false
                        switchFeed(-1, explicitNext = false)
                    } else if (!feedMode && screen == Screen.FULL) {
                        switchFullEpisode(-1, event.repeatCount)
                    }
                    true
                }
            }
            KeyEvent.KEYCODE_DPAD_DOWN -> {
                if (::episodeDrawer.isInitialized && episodeDrawer.visibility == View.VISIBLE) {
                    super.onKeyDown(keyCode, event)
                } else if (feedOverlay.visibility == View.VISIBLE) {
                    this@MainActivity.handler.removeCallbacks(hideChrome)
                    this@MainActivity.handler.postDelayed(hideChrome, 5000)
                    val navIdx = topNavigationButtons.indexOf(currentFocus)
                    if (navIdx != -1) {
                        val targetAction = when (navIdx) {
                            0 -> playButton
                            1 -> nextEpisodeButton
                            2, 3 -> collectionButton
                            4 -> favButton
                            5 -> speedButton
                            else -> qualityButton
                        }
                        targetAction.requestFocus()
                        true
                    } else if (currentFocus == null || currentFocus == root || currentFocus == playerView) {
                        collectionButton.post { collectionButton.requestFocus() }
                        true
                    } else {
                        super.onKeyDown(keyCode, event)
                    }
                } else {
                    if (event.repeatCount == 0 && feedMode) {
                        resumePaused = false
                        switchFeed(1, explicitNext = true)
                    } else if (!feedMode && screen == Screen.FULL) {
                        switchFullEpisode(1, event.repeatCount)
                    }
                    true
                }
            }
            else -> super.onKeyDown(keyCode, event)
        }
    }

    @android.annotation.SuppressLint("RestrictedApi")
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK && dialog == null) {
            if (currentFocus is android.widget.EditText) {
                return super.dispatchKeyEvent(event)
            }
            if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) back()
            return true
        }
        return super.dispatchKeyEvent(event)
    }
}
