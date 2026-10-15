package com.hongguotv.tv.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.hongguotv.tv.ArtworkLoader
import com.hongguotv.tv.R
import com.hongguotv.tv.Series
import com.hongguotv.tv.SeriesAdapter
import com.hongguotv.tv.TvUi

internal class CatalogScreenView(
    context: Context,
    val title: String,
    val source: String,
    val rows: List<Series>,
    val selectedCategory: String,
    val selectedTag: String,
    val categoryTypes: List<Pair<String, String>>,
    val categoryTags: List<Pair<String, String>>,
    val categoryFilterFocus: String?,
    val rankTypes: List<Pair<String, String>> = emptyList(),
    val selectedRank: String = "",
    val artwork: ArtworkLoader,
    val onFilterSelected: (String, String, String) -> Unit,
    val onRankSelected: (String) -> Unit = {},
    val onRefreshHistory: () -> Unit,
    val onReturnFeed: () -> Unit,
    val onSeriesClick: (Series, GridLayoutManager) -> Unit,
    val onSeriesFocused: (Series) -> Unit,
    val onSubtitleProvider: (Series) -> String = { it.badge },
    val onProgressProvider: (Series) -> Float? = { null }
) : LinearLayout(context) {

    var gridView: RecyclerView? = null
    var manager: GridLayoutManager? = null
    val categoryButtons = mutableListOf<Button>()
    val rankButtons = mutableListOf<Button>()

    val tools: LinearLayout
    var loadMoreButton: Button? = null
    private var rightArea: LinearLayout? = null

    init {
        orientation = VERTICAL
        setBackgroundColor(TvUi.BACKGROUND)
        val padH = TvUi.dimen(context, R.dimen.search_page_pad_h)
        val padV = TvUi.dimen(context, R.dimen.search_page_pad_v)
        setPadding(padH, padV, padH, padV)

        val contentTarget: ViewGroup

        if (source == "category") {
            // Horizontal row containing: Left side dual-rail + Right content area
            val contentRow = LinearLayout(context).apply {
                orientation = HORIZONTAL
            }
            addView(contentRow, LayoutParams(-1, 0, 1f))

            val railWidth = TvUi.dimen(context, R.dimen.catalog_rail_width)
            val railPad = TvUi.dimen(context, R.dimen.catalog_rail_pad)
            val railGap = TvUi.dimen(context, R.dimen.catalog_rail_gap)
            val btnHeight = TvUi.dimen(context, R.dimen.catalog_rail_btn_height)
            val btnTextSizePx = context.resources.getDimension(R.dimen.catalog_rail_btn_text)
            val labelTextSizePx = context.resources.getDimension(R.dimen.catalog_rail_label_text)

            val leftRail = LinearLayout(context).apply {
                orientation = HORIZONTAL
                setPadding(railPad, railPad, railPad, railPad)
                background = TvUi.surface(0xcc0b0f19.toInt(), TvUi.BORDER_SUBTLE, radius = 16f, strokeWidth = 1)
            }

            // Column 1: Type Column (不滚动)
            val typeCol = LinearLayout(context).apply {
                orientation = VERTICAL
                val typeLabel = TextView(context).apply {
                    text = "类型"
                    setTextSize(TypedValue.COMPLEX_UNIT_PX, labelTextSizePx)
                    setTextColor(TvUi.TEXT_DIM)
                    setTypeface(typeface, Typeface.BOLD)
                    gravity = Gravity.CENTER
                    setPadding(0, 0, 0, railGap)
                }
                addView(typeLabel, LayoutParams(-1, -2))
            }

            val typeButtons = mutableListOf<Button>()
            categoryTypes.forEach { (id, label) ->
                val isSelected = (id == selectedCategory)
                val key = "分类筛选：type:$id"
                val btn = Button(context).apply {
                    this.id = View.generateViewId()
                    text = label
                    isAllCaps = false
                    isSingleLine = true
                    maxLines = 1
                    ellipsize = TextUtils.TruncateAt.END
                    setTextSize(TypedValue.COMPLEX_UNIT_PX, btnTextSizePx)
                    setPadding(TvUi.dp(context, 2), 0, TvUi.dp(context, 2), 0)
                    gravity = Gravity.CENTER
                    minWidth = 0
                    minimumWidth = 0
                    minHeight = 0
                    minimumHeight = 0
                    this.isSelected = isSelected
                    contentDescription = key
                    setTextColor(if (isSelected) Color.WHITE else TvUi.TEXT_MUTED)
                    background = TvUi.pillBackground(isSelected, TvUi.PANEL, TvUi.BORDER_SUBTLE, radius = 14f)
                    setOnClickListener {
                        onFilterSelected(key, "type", id)
                    }
                    setOnFocusChangeListener { v, f ->
                        v.scaleX = if (f) 1.05f else 1f
                        v.scaleY = if (f) 1.05f else 1f
                    }
                    nextFocusLeftId = this.id
                }
                categoryButtons += btn
                typeButtons += btn
                typeCol.addView(btn, LayoutParams(-1, btnHeight).apply {
                    bottomMargin = railGap
                })
            }
            leftRail.addView(typeCol, LayoutParams(0, -1, 1f))

            // Column 2: Tag Column (带垂直滚动)
            val tagCol = LinearLayout(context).apply {
                orientation = VERTICAL
                val tagLabel = TextView(context).apply {
                    text = "题材"
                    setTextSize(TypedValue.COMPLEX_UNIT_PX, labelTextSizePx)
                    setTextColor(TvUi.TEXT_DIM)
                    setTypeface(typeface, Typeface.BOLD)
                    gravity = Gravity.CENTER
                    setPadding(0, 0, 0, railGap)
                }
                addView(tagLabel, LayoutParams(-1, -2))
            }

            val tagScroll = ScrollView(context).apply {
                this.id = View.generateViewId()
                isVerticalScrollBarEnabled = false
            }
            val tagListLayout = LinearLayout(context).apply {
                orientation = VERTICAL
            }
            tagScroll.addView(tagListLayout, ViewGroup.LayoutParams(-1, -2))
            tagCol.addView(tagScroll, LayoutParams(-1, 0, 1f))

            val tagButtons = mutableListOf<Button>()
            val allTags = listOf("" to "全部题材") + categoryTags
            allTags.forEach { (id, label) ->
                val isSelected = (id == selectedTag)
                val key = "分类筛选：tag:$id"
                val btn = Button(context).apply {
                    this.id = View.generateViewId()
                    text = label
                    isAllCaps = false
                    isSingleLine = true
                    maxLines = 1
                    ellipsize = TextUtils.TruncateAt.END
                    setTextSize(TypedValue.COMPLEX_UNIT_PX, btnTextSizePx)
                    setPadding(TvUi.dp(context, 2), 0, TvUi.dp(context, 2), 0)
                    gravity = Gravity.CENTER
                    minWidth = 0
                    minimumWidth = 0
                    minHeight = 0
                    minimumHeight = 0
                    this.isSelected = isSelected
                    contentDescription = key
                    setTextColor(if (isSelected) Color.WHITE else TvUi.TEXT_MUTED)
                    background = TvUi.pillBackground(isSelected, TvUi.PANEL, TvUi.BORDER_SUBTLE, radius = 14f)
                    setOnClickListener {
                        onFilterSelected(key, "tag", id)
                    }
                    setOnFocusChangeListener { v, f ->
                        v.scaleX = if (f) 1.05f else 1f
                        v.scaleY = if (f) 1.05f else 1f
                        if (f) {
                            v.post {
                                val targetY = v.top - tagScroll.height / 2 + v.height / 2
                                tagScroll.smoothScrollTo(0, targetY.coerceAtLeast(0))
                            }
                        }
                    }
                }
                categoryButtons += btn
                tagButtons += btn
                tagListLayout.addView(btn, LayoutParams(-1, btnHeight).apply {
                    bottomMargin = railGap
                })
            }
            leftRail.addView(tagCol, LayoutParams(0, -1, 1f).apply {
                marginStart = railGap
            })

            contentRow.addView(leftRail, LayoutParams(railWidth, -1))

            // Right content area
            val rightCol = LinearLayout(context).apply {
                orientation = VERTICAL
            }
            rightArea = rightCol
            val rightMarginStart = TvUi.dp(context, 10)
            contentRow.addView(rightCol, LayoutParams(0, -1, 1f).apply {
                marginStart = rightMarginStart
            })

            val titleView = TvUi.title(context, title).apply {
                setPadding(TvUi.dp(context, 4), 0, TvUi.dp(context, 4), TvUi.dp(context, 4))
            }
            rightCol.addView(titleView, LayoutParams(-1, -2))
            contentTarget = rightCol
        } else {
            // Rank, history, favorites: preserve original layout
            addView(TvUi.title(context, title))
            contentTarget = this
        }

        tools = TvUi.row(context)

        if (source == "rank") {
            if (rankTypes.size > 1) {
                val rankScroll = HorizontalScrollView(context).apply {
                    isHorizontalScrollBarEnabled = false
                    setPadding(0, 0, 0, TvUi.dimen(context, R.dimen.rank_tab_pad_bottom))
                }
                val rankRow = TvUi.row(context)
                val tabMarginEnd = TvUi.dimen(context, R.dimen.rank_tab_margin_end)

                rankTypes.forEach { (slug, name) ->
                    val isSelected = (slug == selectedRank)
                    val rankBtn = TvUi.pillButton(context, name, active = isSelected) {
                        onRankSelected(slug)
                    }.apply {
                        contentDescription = "榜单：$name"
                        setSelected(isSelected)
                        setTextColor(if (isSelected) Color.WHITE else TvUi.TEXT_MUTED)
                        setOnFocusChangeListener { v, f ->
                            v.scaleX = if (f) 1.05f else 1f
                            v.scaleY = if (f) 1.05f else 1f
                        }
                    }
                    rankButtons += rankBtn
                    rankRow.addView(rankBtn, LayoutParams(-2, -2).apply {
                        marginEnd = tabMarginEnd
                    })
                }
                rankScroll.addView(rankRow)
                tools.addView(rankScroll, LayoutParams(-1, -2))
            }
        }
        if (source == "history") {
            tools.addView(TvUi.pillButton(context, "刷新") { onRefreshHistory() })
        }
        contentTarget.addView(tools)

        val initialFocusView: View? = if (source == "rank") {
            rankButtons.firstOrNull { it.isSelected } ?: rankButtons.firstOrNull()
        } else if (categoryButtons.isNotEmpty()) {
            categoryButtons.firstOrNull { it.contentDescription == categoryFilterFocus }
        } else null

        if (rows.isEmpty()) {
            contentTarget.addView(TvUi.text(context, "暂时没有内容"))
            val returnBtn = TvUi.pillButton(context, "返回推荐", active = true) { onReturnFeed() }
            contentTarget.addView(returnBtn, LayoutParams(-2, -2))
            val focusBtn = initialFocusView ?: returnBtn
            post { focusBtn.requestFocus() }
        } else {
            val gridManager = GridLayoutManager(context, 5)
            manager = gridManager
            val grid = RecyclerView(context).apply {
                this.id = View.generateViewId()
                layoutManager = gridManager
                descendantFocusability = ViewGroup.FOCUS_AFTER_DESCENDANTS
            }
            gridView = grid
            grid.adapter = SeriesAdapter(rows, artwork, { series ->
                onSeriesClick(series, gridManager)
            }, { series ->
                onSeriesFocused(series)
            }, onSubtitleProvider, onProgressProvider)
            contentTarget.addView(grid, LayoutParams(-1, 0, 1f))

            if (source == "category") {
                // Link tag buttons to jump into grid on RIGHT
                categoryButtons.forEach { btn ->
                    if (btn.contentDescription?.startsWith("分类筛选：tag:") == true) {
                        btn.nextFocusRightId = grid.id
                    }
                }
            }
        }
    }

    fun addLoadMoreButton(text: String, onClick: () -> Unit): Button {
        val btn = TvUi.pillButton(context, text) { onClick() }
        loadMoreButton = btn
        val target: ViewGroup = if (source == "category" && rightArea != null) rightArea!! else this
        target.addView(btn)
        return btn
    }
}
