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

    // Center Seek HUD
    private lateinit var seekHud: LinearLayout
    private lateinit var seekHudDelta: TextView
    private lateinit var seekHudText: TextView
    private var accumulatedSeekDelta = 0L
    private var lastSeekTimestamp = 0L
    private val hideSeekHud = Runnable {
        seekHud.visibility = View.GONE
        accumulatedSeekDelta = 0L
        if (player?.isPlaying == false && !overlayVisible && dialog == null && (screen == Screen.FEED || screen == Screen.FULL)) {
            pauseIndicator.visibility = View.VISIBLE
        }
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
    private var selectedCategory = "real-drama"
    private var selectedTag = ""
    private var categoryTypes = emptyList<Pair<String, String>>()
    private var categoryTags = emptyList<Pair<String, String>>()
    private var categoryTagsType = ""
    private var categoryFilterFocus: String? = null
    private var selectedRank = "hot-drama"
    private var searchQuery = ""
    private var lastSavedAt = 0L
    private var lastHistoryRefresh = 0L

    private enum class Screen { FEED, FULL, CATALOG, DETAIL, SETTINGS }
    private data class Catalog(val title: String, val source: String, var page: Int = 1,
                                var rows: List<Series> = emptyList(), var focusedId: String? = null,
                                var ended: Boolean = false)
    private fun repository() = TvRepository(getSharedPreferences("hongguotv_tv_v1", MODE_PRIVATE).getString("contentTestOrigin", null) ?: localContent.baseUrl)
    private fun dp(value: Int) = TvUi.dp(this, value)

    private fun focusPlayback() {
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
        root.addView(scrimTopView, FrameLayout.LayoutParams(-1, dp(96), Gravity.TOP))

        scrimBottomView = View(this).apply {
            background = TvUi.scrimBottom()
        }
        root.addView(scrimBottomView, FrameLayout.LayoutParams(-1, dp(280), Gravity.BOTTOM))

        // 4. Modern Header (Logo + Title + Subtitle + Nav Tabs + Settings)
        buildHeader()

        // 5. In-Player Full Reference Overlay
        buildFeedOverlay()

        // 6. Center Pause Indicator
        buildPauseIndicator()

        // 7. Center Seek HUD
        buildSeekHud()

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
        startFeed()
    }

    private fun buildHeader() {
        topHeader = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(28), dp(8), dp(28), dp(8))
        }

        // Left Brand Logo Block
        val brandBox = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val logoIcon = TvUi.logoIcon(this)
        brandBox.addView(logoIcon, LinearLayout.LayoutParams(dp(34), dp(34)).apply { marginEnd = dp(10) })

        val brandTitle = TextView(this).apply {
            text = "红果短剧"
            textSize = 17f
            setTextColor(Color.WHITE)
            setTypeface(typeface, Typeface.BOLD)
        }
        brandBox.addView(brandTitle)
        topHeader.addView(brandBox, LinearLayout.LayoutParams(-2, -2).apply { marginEnd = dp(24) })

        // Center Tabs Scroll
        topNavigation = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
        }
        val navRow = TvUi.row(this)
        val destinations = listOf(
            "推荐" to { returnToFeed(autoplay = true) },
            "搜索" to { showSearch() },
            "分类" to { openCatalog("分类", "category") },
            "榜单" to { openCatalog("排行榜", "rank") },
            "追剧" to { openCatalog("我的收藏", "favorites") },
            "历史" to { openCatalog("观看历史", "history") }
        )
        destinations.forEachIndexed { idx, (label, action) ->
            val isActive = (idx == 0)
            val button = Button(this).apply {
                id = View.generateViewId()
                text = label
                contentDescription = "导航：$label"
                textSize = 14f
                isAllCaps = false
                setTextColor(Color.WHITE)
                background = TvUi.pillBackground(active = isActive)
                minHeight = dp(36)
                setPadding(dp(16), dp(4), dp(16), dp(4))
                setOnClickListener { action() }
                setOnFocusChangeListener { view, focused ->
                    if (focused && feedOverlay.visibility == View.VISIBLE) {
                        this@MainActivity.handler.removeCallbacks(hideChrome)
                        this@MainActivity.handler.postDelayed(hideChrome, 5000)
                    }
                    view.scaleX = if (focused) 1.05f else 1f
                    view.scaleY = if (focused) 1.05f else 1f
                }
            }
            topNavigationButtons.add(button)
            navRow.addView(button, LinearLayout.LayoutParams(-2, dp(38)).apply { marginEnd = dp(6) })
        }
        topNavigation.addView(navRow)
        topHeader.addView(topNavigation, LinearLayout.LayoutParams(0, -2, 1f))

        // Right Settings Button
        val settingsBtn = Button(this).apply {
            id = View.generateViewId()
            text = "设置"
            contentDescription = "导航：设置"
            textSize = 14f
            isAllCaps = false
            setTextColor(TvUi.TEXT_MUTED)
            background = TvUi.pillBackground(active = false)
            minHeight = dp(36)
            setPadding(dp(16), dp(4), dp(16), dp(4))
            setOnClickListener { showSettings() }
            setOnFocusChangeListener { view, focused ->
                if (focused && feedOverlay.visibility == View.VISIBLE) {
                    this@MainActivity.handler.removeCallbacks(hideChrome)
                    this@MainActivity.handler.postDelayed(hideChrome, 5000)
                }
                view.scaleX = if (focused) 1.05f else 1f
                view.scaleY = if (focused) 1.05f else 1f
            }
        }
        topNavigationButtons.add(settingsBtn)
        topHeader.addView(settingsBtn, LinearLayout.LayoutParams(-2, dp(38)))

        root.addView(topHeader, FrameLayout.LayoutParams(-1, dp(58), Gravity.TOP))
    }

    private fun buildFeedOverlay() {
        feedOverlay = FrameLayout(this)

        // 1. Top-Left: "第 1 集" Pill Badge
        episodeBadge = TextView(this).apply {
            text = "第 1 集"
            textSize = 12f
            setTextColor(TvUi.RED)
            setTypeface(typeface, Typeface.BOLD)
            background = TvUi.surface(0xaa070a13.toInt(), 0x55f43f5e.toInt(), radius = 40f, strokeWidth = 2)
            setPadding(dp(14), dp(5), dp(14), dp(5))
        }
        feedOverlay.addView(episodeBadge, FrameLayout.LayoutParams(-2, -2).apply {
            gravity = Gravity.TOP or Gravity.START
            marginStart = dp(28)
            topMargin = dp(66)
        })



        // 3. Bottom-Left Information & Action Buttons
        val bottomLeftBox = TvUi.column(this)
        infoTitle = TextView(this).apply {
            text = "@短剧精选"
            textSize = 21f
            setTextColor(Color.WHITE)
            setTypeface(typeface, Typeface.BOLD)
            setShadowLayer(8f, 0f, 2f, 0xee000000.toInt())
        }
        infoSubtitle = TextView(this).apply {
            text = "第 1 集 · 精彩内容加载中"
            textSize = 13.5f
            setTextColor(0xfff1f5f9.toInt())
            setTypeface(typeface, Typeface.BOLD)
            setShadowLayer(6f, 0f, 1f, 0xee000000.toInt())
            setPadding(0, dp(2), 0, dp(2))
        }
        infoTags = TextView(this).apply {
            text = "#短剧  #爆款推荐"
            textSize = 12f
            setTextColor(TvUi.AMBER)
            setTypeface(typeface, Typeface.BOLD)
            setShadowLayer(6f, 0f, 1f, 0xee000000.toInt())
            setPadding(0, 0, 0, dp(3))
        }
        infoDesc = TextView(this).apply {
            text = "精彩短剧连播，高潮迭起，逆袭反转不停歇！"
            textSize = 11.5f
            setTextColor(TvUi.TEXT_MUTED)
            maxLines = 2
            setLineSpacing(dp(2).toFloat(), 1f)
            setShadowLayer(6f, 0f, 1f, 0xee000000.toInt())
        }
        val actionsRow = TvUi.row(this).apply {
            setPadding(0, dp(6), 0, 0)
        }

        // 1. 继续播放 / 暂停播放
        playButton = Button(this).apply {
            id = View.generateViewId()
            text = "继续播放"
            textSize = 13f
            isAllCaps = false
            setTextColor(Color.WHITE)
            background = TvUi.pillBackground(active = false, radius = 24f)
            minHeight = dp(38)
            setPadding(dp(16), dp(4), dp(16), dp(4))
            setOnClickListener {
                if (player?.isPlaying == true) {
                    player?.pause()
                    resumePaused = true
                    text = "继续播放"
                } else {
                    resumePaused = false
                    player?.play()
                    text = "暂停播放"; overlayVisible=false;hideChromeNow()
                }
            }
            setOnFocusChangeListener { v, f ->
                if (f && feedOverlay.visibility == View.VISIBLE) {
                    this@MainActivity.handler.removeCallbacks(hideChrome)
                    this@MainActivity.handler.postDelayed(hideChrome, 5000)
                }
                v.scaleX = if (f) 1.06f else 1f
                v.scaleY = if (f) 1.06f else 1f
            }
        }
        actionsRow.addView(playButton, LinearLayout.LayoutParams(-2, dp(38)).apply { marginEnd = dp(10) })

        // 2. 下一集
        nextEpisodeButton = Button(this).apply {
            id = View.generateViewId()
            text = "下一集"
            textSize = 13f
            isAllCaps = false
            setTextColor(Color.WHITE)
            background = TvUi.pillBackground(active = false, radius = 24f)
            minHeight = dp(38)
            setPadding(dp(16), dp(4), dp(16), dp(4))
            setOnClickListener {
                val detail = activeDetail
                if (detail != null && activeIndex + 1 < detail.episodes.size) {
                    saveProgress()
                    resumePaused = false
                    loadEpisode(activeIndex + 1)
                } else {
                    switchFeed(1,explicitNext=true)
                }
            }
            setOnFocusChangeListener { v, f ->
                if (f && feedOverlay.visibility == View.VISIBLE) {
                    this@MainActivity.handler.removeCallbacks(hideChrome)
                    this@MainActivity.handler.postDelayed(hideChrome, 5000)
                }
                v.scaleX = if (f) 1.06f else 1f
                v.scaleY = if (f) 1.06f else 1f
            }
        }
        actionsRow.addView(nextEpisodeButton, LinearLayout.LayoutParams(-2, dp(38)).apply { marginEnd = dp(10) })

        // 3. 合集
        collectionButton = Button(this).apply {
            id = View.generateViewId()
            text = "合集：短剧 | 全集 >"
            textSize = 13f
            isAllCaps = false
            setTextColor(Color.WHITE)
            background = TvUi.pillBackground(active = false, radius = 24f)
            minHeight = dp(38)
            setPadding(dp(16), dp(4), dp(16), dp(4))
            setOnClickListener {
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
            }
            setOnFocusChangeListener { v, f ->
                if (f && feedOverlay.visibility == View.VISIBLE) {
                    this@MainActivity.handler.removeCallbacks(hideChrome)
                    this@MainActivity.handler.postDelayed(hideChrome, 5000)
                }
                v.scaleX = if (f) 1.06f else 1f
                v.scaleY = if (f) 1.06f else 1f
            }
        }
        actionsRow.addView(collectionButton, LinearLayout.LayoutParams(-2, dp(38)).apply { marginEnd = dp(10) })

        // 4. 追剧
        favButton = Button(this).apply {
            id = View.generateViewId()
            text = "♥ 追剧"
            textSize = 13f
            isAllCaps = false
            setTextColor(Color.WHITE)
            background = TvUi.pillBackground(active = false, radius = 24f)
            minHeight = dp(38)
            setPadding(dp(16), dp(4), dp(16), dp(4))
            setOnClickListener {
                activeDetail?.let {
                    store.toggleFavorite(it.series)
                    updateFavState()
                }
            }
            setOnFocusChangeListener { v, f ->
                if (f && feedOverlay.visibility == View.VISIBLE) {
                    this@MainActivity.handler.removeCallbacks(hideChrome)
                    this@MainActivity.handler.postDelayed(hideChrome, 5000)
                }
                v.scaleX = if (f) 1.06f else 1f
                v.scaleY = if (f) 1.06f else 1f
            }
        }
        actionsRow.addView(favButton, LinearLayout.LayoutParams(-2, dp(38)).apply { marginEnd = dp(10) })

        // 5. 倍速
        speedButton = Button(this).apply {
            id = View.generateViewId()
            text = "${store.speed}x"
            textSize = 13f
            isAllCaps = false
            setTextColor(Color.WHITE)
            background = TvUi.pillBackground(active = false, radius = 24f)
            minHeight = dp(38)
            setPadding(dp(16), dp(4), dp(16), dp(4))
            setOnClickListener { chooseSpeed() }
            setOnFocusChangeListener { v, f ->
                if (f && feedOverlay.visibility == View.VISIBLE) {
                    this@MainActivity.handler.removeCallbacks(hideChrome)
                    this@MainActivity.handler.postDelayed(hideChrome, 5000)
                }
                v.scaleX = if (f) 1.06f else 1f
                v.scaleY = if (f) 1.06f else 1f
            }
        }
        actionsRow.addView(speedButton, LinearLayout.LayoutParams(-2, dp(38)).apply { marginEnd = dp(10) })

        // 6. 清晰度
        qualityButton = Button(this).apply {
            id = View.generateViewId()
            text = quality.ifBlank { "1080P" }
            textSize = 13f
            isAllCaps = false
            setTextColor(Color.WHITE)
            background = TvUi.pillBackground(active = false, radius = 24f)
            minHeight = dp(38)
            setPadding(dp(16), dp(4), dp(16), dp(4))
            setOnClickListener { chooseQuality() }
            setOnFocusChangeListener { v, f ->
                if (f && feedOverlay.visibility == View.VISIBLE) {
                    this@MainActivity.handler.removeCallbacks(hideChrome)
                    this@MainActivity.handler.postDelayed(hideChrome, 5000)
                }
                v.scaleX = if (f) 1.06f else 1f
                v.scaleY = if (f) 1.06f else 1f
            }
        }
        actionsRow.addView(qualityButton, LinearLayout.LayoutParams(-2, dp(38)))

        playButton.apply {
            nextFocusLeftId = playButton.id
            nextFocusRightId = nextEpisodeButton.id
        }
        nextEpisodeButton.apply {
            nextFocusLeftId = playButton.id
            nextFocusRightId = collectionButton.id
        }
        collectionButton.apply {
            nextFocusLeftId = nextEpisodeButton.id
            nextFocusRightId = favButton.id
        }
        favButton.apply {
            nextFocusLeftId = collectionButton.id
            nextFocusRightId = speedButton.id
        }
        speedButton.apply {
            nextFocusLeftId = favButton.id
            nextFocusRightId = qualityButton.id
        }
        qualityButton.apply {
            nextFocusLeftId = speedButton.id
            nextFocusRightId = qualityButton.id
        }
        topNavigationButtons.forEach { it.nextFocusDownId=playButton.id }
        listOf(playButton,nextEpisodeButton,collectionButton,favButton,speedButton,qualityButton).forEach { it.nextFocusUpId=topNavigationButtons.first().id }

        bottomLeftBox.addView(infoTitle)
        bottomLeftBox.addView(infoSubtitle)
        bottomLeftBox.addView(infoTags)
        bottomLeftBox.addView(infoDesc)
        bottomLeftBox.addView(actionsRow)

        feedOverlay.addView(bottomLeftBox, FrameLayout.LayoutParams(-2, -2).apply {
            gravity = Gravity.BOTTOM or Gravity.START
            marginStart = dp(28)
            bottomMargin = dp(46)
        })

        // Bottom Seekbar & Timestamp Row
        progressBox = TvUi.column(this)
        val timeRow = TvUi.row(this)
        timeText = TextView(this).apply {
            text = "00:00 / 00:00"
            textSize = 11.5f
            setTextColor(Color.WHITE)
            typeface = Typeface.MONOSPACE
        }
        timeRow.addView(timeText, LinearLayout.LayoutParams(-2, -2))
        progressBox.addView(timeRow)

        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 1000
            progressTintList = ColorStateList.valueOf(TvUi.RED)
            progressBackgroundTintList = ColorStateList.valueOf(0x44ffffff.toInt())
        }
        progressBox.addView(progressBar, LinearLayout.LayoutParams(-1, dp(5)).apply {
            topMargin = dp(4)
        })

        root.addView(feedOverlay, FrameLayout.LayoutParams(-1, -1))
        root.addView(progressBox, FrameLayout.LayoutParams(-1, -2).apply {
            gravity = Gravity.BOTTOM
            marginStart = dp(28)
            marginEnd = dp(28)
            bottomMargin = dp(12)
        })
    }

    private fun buildPauseIndicator() {
        val indicator = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            visibility = View.GONE
            isFocusable = false
            isClickable = false
            background = TvUi.surface(0xdd0f172a.toInt(), 0x33ffffff.toInt(), radius = 36f, strokeWidth = 2)
            setPadding(dp(20), dp(12), dp(22), dp(12))
        }

        val iconBadge = TextView(this).apply {
            text = "❚❚"
            textSize = 12f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(TvUi.RED)
            }
        }
        val iconSize = dp(32)
        indicator.addView(iconBadge, LinearLayout.LayoutParams(iconSize, iconSize).apply { marginEnd = dp(12) })

        val textCol = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val pauseTitle = TextView(this).apply {
            text = "播放已暂停"
            textSize = 15f
            setTextColor(Color.WHITE)
            setTypeface(typeface, Typeface.BOLD)
        }
        val pauseHint = TextView(this).apply {
            text = "按遥控器确认键继续播放"
            textSize = 11.5f
            setTextColor(TvUi.TEXT_MUTED)
        }
        textCol.addView(pauseTitle)
        textCol.addView(pauseHint)
        indicator.addView(textCol)

        pauseIndicator = indicator
        root.addView(pauseIndicator, FrameLayout.LayoutParams(-2, -2, Gravity.CENTER))
    }

    private fun buildSeekHud() {
        seekHud = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            visibility = View.GONE
            isFocusable = false
            isClickable = false
            background = TvUi.surface(0xee0b0f19.toInt(), 0x33ffffff.toInt(), radius = 32f, strokeWidth = 2)
            setPadding(dp(22), dp(12), dp(24), dp(12))
        }

        seekHudDelta = TextView(this).apply {
            text = "▶▶ +10s"
            textSize = 14f
            setTextColor(TvUi.AMBER)
            setTypeface(typeface, Typeface.BOLD)
            setPadding(dp(8), dp(3), dp(8), dp(3))
            background = TvUi.surface(0x33fbbf24.toInt(), radius = 14f)
        }
        seekHud.addView(seekHudDelta, LinearLayout.LayoutParams(-2, -2).apply { marginEnd = dp(14) })

        seekHudText = TextView(this).apply {
            text = "00:00 / 00:00"
            textSize = 15f
            setTextColor(Color.WHITE)
            setTypeface(Typeface.MONOSPACE, Typeface.BOLD)
        }
        seekHud.addView(seekHudText)

        root.addView(seekHud, FrameLayout.LayoutParams(-2, -2, Gravity.CENTER))
    }

    private fun buildEpisodeDrawer() {
        episodeDrawer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            background = TvUi.surface(0xf20b0f19.toInt(), 0x33ffffff.toInt(), radius = 24f, strokeWidth = 2)
            setPadding(dp(24), dp(16), dp(24), dp(16))
            isFocusable = false
        }

        // 1. Top row: Title + Group Tabs + Full Detail Button
        val topRow = TvUi.row(this)
        episodeDrawerTitle = TextView(this).apply {
            text = "选集列表"
            textSize = 15.5f
            setTextColor(Color.WHITE)
            setTypeface(typeface, Typeface.BOLD)
        }
        topRow.addView(episodeDrawerTitle, LinearLayout.LayoutParams(-2, -2).apply { marginEnd = dp(16) })

        episodeDrawerGroupRow = TvUi.row(this)
        topRow.addView(episodeDrawerGroupRow, LinearLayout.LayoutParams(0, -2, 1f))

        val fullDetailBtn = Button(this).apply {
            text = "查看详情 >"
            textSize = 12.5f
            isAllCaps = false
            setTextColor(TvUi.TEXT_MUTED)
            background = TvUi.pillBackground(active = false, radius = 20f)
            minHeight = dp(32)
            setPadding(dp(12), dp(2), dp(12), dp(2))
            setOnClickListener {
                hideEpisodeDrawer(returnToMenu = false)
                browsingDetail = activeDetail
                detailOrigin = Screen.FEED
                feedReturnPosition = activeIndex to (player?.currentPosition ?: savedPosition)
                detailFocus = activeIndex % 50
                episodeGroup = activeIndex / 50
                showDetail()
            }
            setOnFocusChangeListener { v, f ->
                v.scaleX = if (f) 1.05f else 1f
                v.scaleY = if (f) 1.05f else 1f
            }
        }
        topRow.addView(fullDetailBtn, LinearLayout.LayoutParams(-2, dp(32)))
        episodeDrawer.addView(topRow)

        // 2. Horizontal Scroll of Episode Pills
        episodeDrawerScroll = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            setPadding(0, dp(10), 0, 0)
        }
        episodeDrawerList = TvUi.row(this)
        episodeDrawerScroll.addView(episodeDrawerList)
        episodeDrawer.addView(episodeDrawerScroll, LinearLayout.LayoutParams(-1, -2))

        root.addView(episodeDrawer, FrameLayout.LayoutParams(-1, -2).apply {
            gravity = Gravity.BOTTOM
            marginStart = dp(16)
            marginEnd = dp(16)
            bottomMargin = dp(14)
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
                episodeDrawerScroll.smoothScrollTo(btn.left - dp(80), 0)
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
                    minHeight = dp(30)
                    setPadding(dp(12), dp(2), dp(12), dp(2))
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
                episodeDrawerGroupRow.addView(groupBtn, LinearLayout.LayoutParams(-2, dp(30)).apply { marginEnd = dp(6) })
            }
        }

        // 2. Episodes list for drawerEpisodeGroup
        episodeDrawerList.removeAllViews()
        drawerEpisodeButtons.clear()
        val visible = detail.episodes.drop(drawerEpisodeGroup * 50).take(50)
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
                minHeight = dp(42)
                setPadding(dp(16), dp(4), dp(16), dp(4))
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
            episodeDrawerList.addView(btn, LinearLayout.LayoutParams(-2, dp(42)).apply { marginEnd = dp(8) })
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
        foreground=false
        updateRecommendationPlaying(false);flushRecommendation()
        foreground = false; history.foreground(false); resumePaused = true; saveProgress()
        playbackJob?.cancel(); playbackGeneration.next(); feedJob?.cancel()
        navigationJob?.cancel(); navigationGeneration.next()
        playerView.player = null; player?.release(); player = null
        super.onStop()
    }
    override fun onDestroy() {
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
        focusPlayback()
    }

    private val hideChrome = Runnable {
        if (!overlayVisible && dialog == null && (screen == Screen.FEED || screen == Screen.FULL)) {
            hideChromeNow()
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
        navigationJob?.cancel(); navigationGeneration.next(); navigation.removeAllViews()
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
                        if ((screen == Screen.FEED || screen == Screen.FULL) && !overlayVisible && dialog == null) {
                            pauseIndicator.visibility = View.VISIBLE
                        }
                    }
                }
                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_ENDED) {
                        // Clearing/replacing a playlist also emits ENDED. Only the active media may complete.
                        val episode=activeDetail?.episodes?.getOrNull(activeIndex) ?: return
                        if(!PlaybackPolicy.canSaveProgress(episode.id,current.currentMediaItem?.mediaId))return
                        pauseIndicator.visibility = View.GONE
                        episodeEnded()
                    }
                }
                override fun onPlayerError(error: PlaybackException) {
                    pauseIndicator.visibility = View.GONE
                    if (!retryUsed) { retryUsed = true; loadEpisode(activeIndex, current.currentPosition, true, false) }
                    else playbackError("视频播放失败，可能是网络或设备解码不支持。")
                }
            })
        }
    }

    private fun loadEpisode(index: Int, position: Long = 0, autoplay: Boolean = true, resetRetry: Boolean = true, afterPrepare: (() -> Unit)? = null) {
        val detail = activeDetail ?: return
        val episode = detail.episodes.getOrNull(index) ?: return
        playbackJob?.cancel(); val generation = playbackGeneration.next()
        if (resetRetry) retryUsed = false
        player?.pause(); player?.clearMediaItems(); activeIndex = index; savedPosition = position
        pauseIndicator.visibility = View.GONE

        // Update In-Player Overlays
        episodeBadge.text = "第 ${episode.number} 集"
        infoTitle.text = "@${detail.series.title}  ${detail.series.badge}"
        infoSubtitle.text = "第 ${episode.number} 集 · 《${detail.series.title}》 第 ${episode.number} 集"
        val tagList = if (detail.series.tags.isNotBlank()) detail.series.tags.split("/").joinToString("  ") { "#${it.trim()}" } else "#短剧  #爆款"
        infoTags.text = "#短剧  $tagList"
        infoDesc.text = detail.series.description.ifBlank { "精彩短剧连播，高潮迭起，逆袭反转不停歇！" }
        collectionButton.text = "合集：${detail.series.title} | 全${detail.episodes.size}集 >"
        playButton.text = if (player?.isPlaying == true) "暂停播放" else "继续播放"
        updateFavState()

        navigation.removeAllViews()
        revealChrome()
        if (!overlayVisible) focusPlayback()
        artwork.load(detail.series.cover, backdrop)

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
                revealChrome()
                afterPrepare?.invoke()
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) { if (playbackGeneration.isCurrent(generation)) playbackError(error.message ?: "内容加载失败") }
        }
    }

    private fun playbackError(message: String) {
        if (!foreground) return
        player?.pause(); overlayVisible = true; revealChrome()
        infoSubtitle.text = message
        collectionButton.text = "重试加载"
        collectionButton.setOnClickListener {
            resumePaused = false; overlayVisible = false; loadEpisode(activeIndex, savedPosition)
        }
        collectionButton.requestFocus()
    }

    private fun episodeEnded() {
        val detail = activeDetail ?: return
        if(activeIndex==detail.episodes.lastIndex){activeRecommendation?.completed=true;flushRecommendation()}
        saveProgress(true)
        if (activeIndex + 1 < detail.episodes.size) loadEpisode(activeIndex + 1)
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
        playbackJob?.cancel(); val generation = playbackGeneration.next()
        revealChrome(); infoTitle.text = "@${series.title} · 加载中"
        playbackJob = scope.launch {
            try {
                val detail = repository().detail(series.id)
                ensureActive(); if (!playbackGeneration.isCurrent(generation)) return@launch
                val typed=detail.copy(series=detail.series.copy(contentType=series.contentType))
                pendingSeries = null; history.begin(store.baseUrl, typed.series); lastRecord = null; activeDetail = typed;activateRecommendation(typed.series)
                val previous=feedPositions[typed.series.id];loadEpisode(previous?.first?:0,previous?.second?:0)
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
        overlayVisible = true; revealChrome()
        infoTitle.text = "@红果短剧"
        infoSubtitle.text = message
        collectionButton.text = "重新加载推荐"
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
            setBackgroundColor(TvUi.BACKGROUND); setPadding(dp(36), dp(24), dp(36), dp(24))
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
        val column = panel("搜索短剧")
        val input = EditText(this).apply {
            hint = "输入剧名或关键词"
            setText(searchQuery)
            textSize = 20f
            setTextColor(Color.WHITE)
            isSingleLine = true
            imeOptions = android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH
            background = TvUi.surface(TvUi.PANEL, TvUi.BORDER_SUBTLE, radius = 24f)
            setPadding(dp(20), dp(12), dp(20), dp(12))
        }
        column.addView(input, LinearLayout.LayoutParams(-1, dp(56)).apply { bottomMargin = dp(16) })

        val submit = { searchQuery = input.text.toString().trim(); if (searchQuery.isNotBlank()) {store.saveSearch(searchQuery);openCatalog("搜索：$searchQuery", "search")} }
        column.addView(TvUi.pillButton(this, "🔍 开始搜索", active = true, submit).apply {
            layoutParams = LinearLayout.LayoutParams(dp(180), dp(44))
        })
        input.setOnEditorActionListener { _, actionId, event ->
            if (actionId == android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH || event?.keyCode == KeyEvent.KEYCODE_ENTER) { submit(); true } else false
        }
        val recent=TvUi.row(this)
        store.searches().take(6).forEach {query->recent.addView(TvUi.pillButton(this,query){input.setText(query);submit()})}
        column.addView(recent)
        input.requestFocus()
    }

    private fun openCatalog(title: String, source: String) {
        stopForNavigation(Screen.CATALOG); catalog = Catalog(title, source); catalogScroll = null
        categoryFilterFocus = null
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
        val generation = navigationGeneration.next(); val snapshot = catalog
        if (!nextPage) panel(snapshot.title).addView(TvUi.text(this, "加载中…"))
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
                snapshot.rows = merged; snapshot.page = page; renderCatalog()
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) {
                if (navigationGeneration.isCurrent(generation)) {
                    val column = panel(snapshot.title); column.addView(TvUi.text(this@MainActivity, error.message ?: "加载失败"))
                    column.addView(TvUi.button(this@MainActivity, "重试") { navigationJob = null; loadCatalog(nextPage) }.apply { requestFocus() })
                }
            }
        }
    }

    private fun renderCatalog(preserveFocus: String? = null) {
        screen = Screen.CATALOG; val column = panel(catalog.title)
        val tools = TvUi.row(this)
        val categoryButtons = mutableListOf<Button>()
        if (catalog.source == "category") {
            fun filters(values: List<Pair<String, String>>, kind: String, selected: String) {
                val group = CategoryTagLayout(this).apply { setPadding(dp(4), dp(4), dp(4), dp(4)) }
                values.forEach { (id, label) ->
                    val key = "分类筛选：$kind:$id"
                    val button = TvUi.pillButton(this, label, active = id == selected) {
                        categoryFilterFocus = key
                        if (kind == "type") {selectedCategory = id;selectedTag=""} else selectedTag = id
                        catalog.page = 1; catalog.focusedId = null; catalogScroll = null
                        navigationJob = null; loadCatalog(false)
                    }.apply {
                        contentDescription = key; isSelected = id == selected
                        minWidth = 0; minimumWidth = 0
                        setTextColor(if (isSelected) Color.WHITE else TvUi.TEXT_MUTED)
                        background = TvUi.pillBackground(isSelected, TvUi.PANEL, TvUi.BORDER_SUBTLE)
                    }
                    categoryButtons += button; group.addView(button)
                }
                column.addView(group, LinearLayout.LayoutParams(-1, -2))
            }
            filters(categoryTypes, "type", selectedCategory)
            filters(listOf("" to "全部题材") + categoryTags, "tag", selectedTag)
        }
        if (catalog.source == "rank") tools.addView(TvUi.pillButton(this, "切换榜单") {
            loadChoices("榜单", { repository().rankTypes() }) {
                selectedRank = it; catalogScroll = null; navigationJob = null; loadCatalog(false)
            }
        })
        if (catalog.source == "history") tools.addView(TvUi.pillButton(this, "刷新") { loadHistory() })
        column.addView(tools)
        if (catalog.rows.isEmpty()) {
            column.addView(TvUi.text(this, "暂时没有内容"))
            column.addView(TvUi.pillButton(this, "返回推荐", active = true) { returnToFeed() }.apply { requestFocus() })
            categoryButtons.firstOrNull { it.contentDescription == categoryFilterFocus }?.requestFocus()
            categoryFilterFocus = null
            return
        }

        val manager = GridLayoutManager(this, 5)
        val grid = RecyclerView(this).apply {
            layoutManager = manager
            descendantFocusability = ViewGroup.FOCUS_AFTER_DESCENDANTS
        }
        catalogGrid = grid
        grid.adapter = SeriesAdapter(catalog.rows, artwork, { series ->
            catalogScroll = manager.onSaveInstanceState()
            if (catalog.source == "history") {
                selectedHistory = historyRows.firstOrNull { it.series.id == series.id }
                openDetail(series, resumeImmediately = true)
            } else {
                selectedHistory = null
                openDetail(series)
            }
        }, { series -> catalog.focusedId = series.id }, subtitle = { series ->
            if (catalog.source == "history") historyRows.firstOrNull { it.series.id == series.id }?.let { "第 ${it.episodeNumber} 集 · ${TvUi.time(it.positionMs)}\n${java.text.DateFormat.getDateTimeInstance(java.text.DateFormat.SHORT,java.text.DateFormat.SHORT).format(java.util.Date(it.updatedAt))}" } ?: series.badge else series.badge
        }, progress = { series -> if(catalog.source=="history")historyRows.firstOrNull{it.series.id==series.id}?.let{if(it.durationMs>0)it.positionMs.toFloat()/it.durationMs else 0f} else null })
        column.addView(grid, LinearLayout.LayoutParams(-1, 0, 1f))
        val index = PlaybackPolicy.restoredIndex(catalog.rows, catalog.focusedId)
        if (catalogScroll != null) manager.onRestoreInstanceState(catalogScroll) else grid.scrollToPosition(index)
        grid.post {
            val filter = categoryButtons.firstOrNull { it.contentDescription == categoryFilterFocus }
            categoryFilterFocus = null
            val tool = (0 until tools.childCount).map { tools.getChildAt(it) }.filterIsInstance<Button>()
                .firstOrNull { preserveFocus != null && it.text.toString().removePrefix("● ") == preserveFocus.removePrefix("● ") }
            filter?.requestFocus() ?: tool?.requestFocus() ?: (manager.findViewByPosition(index)?.requestFocus() ?: grid.requestFocus())
        }
        if (!catalog.ended) column.addView(TvUi.pillButton(this, "加载更多 · 第 ${catalog.page} 页") {
            catalogScroll = manager.onSaveInstanceState(); loadCatalog(true)
        })
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
        browsingDetail = detail; stopForNavigation(Screen.DETAIL)
        val column = panel(detail.series.title)
        val top = TvUi.row(this)
        val cover = ImageView(this).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            background = GradientDrawable().apply {
                cornerRadius = dp(10).toFloat()
            }
        }
        artwork.load(detail.series.cover, cover)
        top.addView(cover, LinearLayout.LayoutParams(dp(110), dp(150)).apply { marginEnd = dp(16) })

        val infoCol = TvUi.column(this)
        infoCol.addView(TvUi.text(this, "${detail.series.badge} · ${detail.series.tags}", 14f).apply { setTextColor(TvUi.AMBER) })
        infoCol.addView(TvUi.text(this, detail.series.description, 14.5f).apply {
            maxLines = 4
            setTextColor(TvUi.TEXT_MUTED)
        })
        top.addView(infoCol, LinearLayout.LayoutParams(0, -2, 1f))
        column.addView(top)

        // Action Buttons
        val controls = TvUi.row(this).apply {
            setPadding(0, dp(12), 0, dp(12))
        }
        val play = TvUi.pillButton(this, "▶ 从头播放") { playDetail(false) }; controls.addView(play)
        controls.addView(TvUi.pillButton(this, "继续观看", active = true) { playDetail(true) })
        controls.addView(TvUi.pillButton(this, if (store.isFavorite(detail.series.id)) "已追剧" else "追剧") {
            store.toggleFavorite(detail.series); showDetail()
        })
        column.addView(controls)

        // Episode Group Horizontal Tabs (Eliminates modal dialog popup)
        val groups = (detail.episodes.size + 49) / 50
        if (groups > 1) {
            val groupScroll = HorizontalScrollView(this).apply {
                isHorizontalScrollBarEnabled = false
                setPadding(0, 0, 0, dp(10))
            }
            val groupRow = TvUi.row(this)
            for (g in 0 until groups) {
                val start = g * 50 + 1
                val end = minOf((g + 1) * 50, detail.episodes.size)
                val isSelected = g == episodeGroup
                val groupBtn = Button(this).apply {
                    text = "$start—$end 集"
                    textSize = 13f
                    isAllCaps = false
                    setTextColor(if (isSelected) Color.WHITE else TvUi.TEXT_MUTED)
                    background = TvUi.pillBackground(active = isSelected, radius = 20f)
                    minHeight = dp(34)
                    setPadding(dp(16), dp(4), dp(16), dp(4))
                    setOnClickListener {
                        episodeGroup = g
                        detailFocus = 0
                        showDetail()
                    }
                    setOnFocusChangeListener { v, f ->
                        v.scaleX = if (f) 1.05f else 1f
                        v.scaleY = if (f) 1.05f else 1f
                    }
                }
                groupRow.addView(groupBtn, LinearLayout.LayoutParams(-2, dp(34)).apply { marginEnd = dp(8) })
            }
            groupScroll.addView(groupRow)
            column.addView(groupScroll)
        }

        // Fixed 8-Column Grid for Episodes (Prevents stretching on incomplete rows)
        val scroll = ScrollView(this); val episodeRows = TvUi.column(this)
        val visible = detail.episodes.drop(episodeGroup * 50).take(50)
        var focusButton: View? = null
        visible.chunked(8).forEachIndexed { rowIndex, chunk ->
            val row = TvUi.row(this)
            chunk.forEachIndexed { offset, episode ->
                val index = episodeGroup * 50 + rowIndex * 8 + offset
                val isCurrent = index == activeIndex
                val button = Button(this).apply {
                    text = episode.number.toString()
                    textSize = 14f
                    setTextColor(Color.WHITE); background = TvUi.pillBackground(active = isCurrent, radius = 10f)
                    setOnClickListener {
                        detailFocus = rowIndex * 8 + offset
                        playDetail(false, index)
                    }
                    setOnFocusChangeListener { v, f ->
                        v.scaleX = if (f) 1.08f else 1f
                        v.scaleY = if (f) 1.08f else 1f
                    }
                }
                row.addView(button, LinearLayout.LayoutParams(0, dp(44), 1f).apply { setMargins(dp(3), dp(3), dp(3), dp(3)) })
                if (rowIndex * 8 + offset == detailFocus || (detailFocus < 0 && isCurrent)) focusButton = button
            }
            // Fill remaining slots in last row with spacers so buttons maintain fixed width!
            for (i in chunk.size until 8) {
                row.addView(View(this), LinearLayout.LayoutParams(0, dp(44), 1f).apply { setMargins(dp(3), dp(3), dp(3), dp(3)) })
            }
            episodeRows.addView(row)
        }
        scroll.addView(episodeRows)
        column.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        if (detailFocus >= 0) focusButton?.requestFocus() else play.requestFocus()
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
        settingsError=null
        val column = panel("远程共享与同步")
        column.addView(TvUi.text(this, "电视已内置内容服务。未配置远程时，收藏、历史和播放偏好保存在本机。", 16f).apply {
            setTextColor(TvUi.TEXT_MUTED)
        })
        val input = EditText(this).apply {
            setText(history.remoteUrl)
            hint = "https://远程共享服务器"
            textSize = 20f
            setTextColor(Color.WHITE)
            isSingleLine = true
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI
            background = TvUi.surface(TvUi.PANEL, TvUi.BORDER_SUBTLE, radius = 18f)
            setPadding(dp(18), dp(12), dp(18), dp(12))
        }
        column.addView(input, LinearLayout.LayoutParams(-1, dp(58)).apply {
            topMargin = dp(8)
            bottomMargin = dp(14)
        })
        val key = EditText(this).apply {
            setText(history.remoteKey); hint = "家庭共享密钥"; textSize=20f; setTextColor(Color.WHITE); isSingleLine=true
            inputType=android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
            background=TvUi.surface(TvUi.PANEL,TvUi.BORDER_SUBTLE,radius=18f);setPadding(dp(18),dp(12),dp(18),dp(12))
        }
        column.addView(key,LinearLayout.LayoutParams(-1,dp(58)).apply{bottomMargin=dp(14)})
        val status = TvUi.text(this, history.status, 14f).apply {
            setTextColor(TvUi.TEXT_MUTED)
        }
        settingsStatus=status
        val connect = TvUi.pillButton(this, "验证并开启同步", active = true) {
            navigationJob?.cancel(); val generation = navigationGeneration.next()
            navigationJob = scope.launch {
                try {
                    settingsError=null;status.text = "正在检查远程服务…"; history.configure(input.text.toString(),key.text.toString())
                    ensureActive(); if (!navigationGeneration.isCurrent(generation)) return@launch
                    status.text=history.status
                } catch (cancelled: CancellationException) { throw cancelled }
                catch (error: Exception) { settingsError="连接失败：${error.message?:"原配置已保留"}";status.text=settingsError }
            }
        }
        column.addView(connect)
        column.addView(TvUi.pillButton(this,"取消远程同步") { scope.launch {history.disable();input.setText("");key.setText("");status.text=history.status} })
        val modeNames=arrayOf("混合推荐","真人剧","漫剧","AI剧")
        val modes=listOf("mixed","real-drama","comic-drama","ai-drama")
        column.addView(TvUi.pillButton(this,"推荐内容：${modeNames[modes.indexOf(store.recommendationMode).coerceAtLeast(0)]}") {
            dialog=AlertDialog.Builder(this).setTitle("推荐内容").setSingleChoiceItems(modeNames,modes.indexOf(store.recommendationMode).coerceAtLeast(0)){ d,index->
                store.recommendationMode=modes[index];d.dismiss();dialog=null;startFeed()
            }.create().also{it.setOnDismissListener{dialog=null};it.show()}
        })
        column.addView(TvUi.pillButton(this,"重置推荐偏好") {confirm("重置推荐兴趣？观看历史和收藏会保留。"){store.resetRecommendationPreferences();startFeed()}})
        column.addView(status)
        navigation.removeView(column)
        val settingsScroll=ScrollView(this).apply {
            isFillViewport=true
            addView(column,ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT))
        }
        navigation.addView(settingsScroll,FrameLayout.LayoutParams(-1,-1))
        input.requestFocus()
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
                        collectionButton.requestFocus()
                    }
                }
            }
        }
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
                    revealChrome()
                    collectionButton.requestFocus()
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
                        collectionButton.requestFocus()
                        true
                    } else {
                        super.onKeyDown(keyCode, event)
                    }
                }
            }
            KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN -> {
                if (::episodeDrawer.isInitialized && episodeDrawer.visibility == View.VISIBLE) {
                    super.onKeyDown(keyCode, event)
                } else if (feedOverlay.visibility != View.VISIBLE) {
                    if (event.repeatCount == 0 && feedMode) {
                        resumePaused = false
                        switchFeed(if (keyCode == KeyEvent.KEYCODE_DPAD_UP) -1 else 1,explicitNext=keyCode==KeyEvent.KEYCODE_DPAD_DOWN)
                    }
                    true
                } else {
                    this@MainActivity.handler.removeCallbacks(hideChrome)
                    this@MainActivity.handler.postDelayed(hideChrome, 5000)
                    if (currentFocus == null || currentFocus == root || currentFocus == playerView) {
                        collectionButton.requestFocus()
                        true
                    } else {
                        super.onKeyDown(keyCode, event)
                    }
                }
            }
            else -> super.onKeyDown(keyCode, event)
        }
    }

    @android.annotation.SuppressLint("RestrictedApi")
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK && dialog == null) {
            if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) back()
            return true
        }
        return super.dispatchKeyEvent(event)
    }
}
