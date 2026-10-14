package com.hongguotv.tv.ui

import android.content.Context
import android.graphics.Color
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.hongguotv.tv.ArtworkLoader
import com.hongguotv.tv.CategoryTagLayout
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

    init {
        orientation = VERTICAL
        setBackgroundColor(TvUi.BACKGROUND)
        val padH = TvUi.dimen(context, R.dimen.search_page_pad_h)
        val padV = TvUi.dimen(context, R.dimen.search_page_pad_v)
        setPadding(padH, padV, padH, padV)

        addView(TvUi.title(context, title))

        tools = TvUi.row(context)

        if (source == "category") {
            fun filters(values: List<Pair<String, String>>, kind: String, selected: String) {
                val groupPad = TvUi.dimen(context, R.dimen.category_tag_group_padding)
                val group = CategoryTagLayout(context).apply { setPadding(groupPad, groupPad, groupPad, groupPad) }
                values.forEach { (id, label) ->
                    val key = "分类筛选：$kind:$id"
                    val button = TvUi.pillButton(context, label, active = id == selected) {
                        onFilterSelected(key, kind, id)
                    }.apply {
                        contentDescription = key
                        isSelected = id == selected
                        minWidth = 0
                        minimumWidth = 0
                        setTextColor(if (isSelected) Color.WHITE else TvUi.TEXT_MUTED)
                        background = TvUi.pillBackground(isSelected, TvUi.PANEL, TvUi.BORDER_SUBTLE)
                    }
                    categoryButtons += button
                    group.addView(button)
                }
                addView(group, LayoutParams(-1, -2))
            }
            filters(categoryTypes, "type", selectedCategory)
            filters(listOf("" to "全部题材") + categoryTags, "tag", selectedTag)
        }

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
        addView(tools)

        val initialFocusView: View? = if (source == "rank") {
            rankButtons.firstOrNull { it.isSelected } ?: rankButtons.firstOrNull()
        } else if (categoryButtons.isNotEmpty()) {
            categoryButtons.firstOrNull { it.contentDescription == categoryFilterFocus }
        } else null

        if (rows.isEmpty()) {
            addView(TvUi.text(context, "暂时没有内容"))
            val returnBtn = TvUi.pillButton(context, "返回推荐", active = true) { onReturnFeed() }
            addView(returnBtn, LayoutParams(-2, -2))
            val focusBtn = initialFocusView ?: returnBtn
            post { focusBtn.requestFocus() }
        } else {
            val gridManager = GridLayoutManager(context, 5)
            manager = gridManager
            val grid = RecyclerView(context).apply {
                layoutManager = gridManager
                descendantFocusability = ViewGroup.FOCUS_AFTER_DESCENDANTS
            }
            gridView = grid
            grid.adapter = SeriesAdapter(rows, artwork, { series ->
                onSeriesClick(series, gridManager)
            }, { series ->
                onSeriesFocused(series)
            }, onSubtitleProvider, onProgressProvider)
            addView(grid, LayoutParams(-1, 0, 1f))
        }
    }

    fun addLoadMoreButton(text: String, onClick: () -> Unit): Button {
        val btn = TvUi.pillButton(context, text) { onClick() }
        loadMoreButton = btn
        addView(btn)
        return btn
    }
}
