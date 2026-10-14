package com.hongguotv.tv.ui

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.View
import android.widget.Button
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import com.hongguotv.tv.ArtworkLoader
import com.hongguotv.tv.Detail
import com.hongguotv.tv.R
import com.hongguotv.tv.TvUi

internal class DetailScreenView(
    context: Context,
    val detail: Detail,
    val isFavorite: Boolean,
    val activeIndex: Int,
    var episodeGroup: Int,
    var detailFocus: Int,
    artwork: ArtworkLoader,
    private val onPlayFromStart: () -> Unit,
    private val onResumePlay: () -> Unit,
    private val onToggleFavorite: () -> Unit,
    private val onGroupChanged: (Int) -> Unit,
    private val onEpisodeSelected: (Int, Int) -> Unit
) : LinearLayout(context) {

    var focusTargetView: View? = null

    init {
        orientation = VERTICAL
        setBackgroundColor(TvUi.BACKGROUND)
        val padH = TvUi.dimen(context, R.dimen.search_page_pad_h)
        val padV = TvUi.dimen(context, R.dimen.search_page_pad_v)
        setPadding(padH, padV, padH, padV)

        addView(TvUi.title(context, detail.series.title))

        val top = TvUi.row(context)
        val cover = ImageView(context).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            background = GradientDrawable().apply {
                cornerRadius = TvUi.dimen(context, R.dimen.detail_cover_corner_radius).toFloat()
            }
        }
        artwork.load(detail.series.cover, cover)
        top.addView(cover, LayoutParams(
            TvUi.dimen(context, R.dimen.detail_cover_width),
            TvUi.dimen(context, R.dimen.detail_cover_height)
        ).apply {
            marginEnd = TvUi.dimen(context, R.dimen.detail_cover_margin_end)
        })

        val infoCol = TvUi.column(context)
        infoCol.addView(TvUi.text(context, "${detail.series.badge} · ${detail.series.tags}", 14f).apply {
            setTextColor(TvUi.AMBER)
        })
        infoCol.addView(TvUi.text(context, detail.series.description, 14.5f).apply {
            maxLines = 4
            setTextColor(TvUi.TEXT_MUTED)
        })
        top.addView(infoCol, LayoutParams(0, -2, 1f))
        addView(top)

        // Action Buttons
        val controls = TvUi.row(context).apply {
            val padDescV = TvUi.dimen(context, R.dimen.detail_desc_pad_v)
            setPadding(0, padDescV, 0, padDescV)
        }
        val play = TvUi.pillButton(context, "▶ 从头播放") { onPlayFromStart() }
        controls.addView(play)
        controls.addView(TvUi.pillButton(context, "继续观看", active = true) { onResumePlay() })
        controls.addView(TvUi.pillButton(context, if (isFavorite) "已追剧" else "追剧") { onToggleFavorite() })
        addView(controls)

        // Episode Group Tabs
        val groups = (detail.episodes.size + 49) / 50
        if (groups > 1) {
            val groupScroll = HorizontalScrollView(context).apply {
                isHorizontalScrollBarEnabled = false
                setPadding(0, 0, 0, TvUi.dimen(context, R.dimen.detail_group_pad_bottom))
            }
            val groupRow = TvUi.row(context)
            val groupMinHeight = TvUi.dimen(context, R.dimen.detail_group_btn_min_height)
            val groupHeight = TvUi.dimen(context, R.dimen.detail_group_btn_height)
            val groupPadH = TvUi.dimen(context, R.dimen.detail_group_btn_pad_h)
            val groupPadV = TvUi.dimen(context, R.dimen.detail_group_btn_pad_v)
            val groupMarginEnd = TvUi.dimen(context, R.dimen.detail_group_btn_margin_end)

            for (g in 0 until groups) {
                val start = g * 50 + 1
                val end = minOf((g + 1) * 50, detail.episodes.size)
                val isSelected = g == episodeGroup
                val groupBtn = Button(context).apply {
                    text = "$start—$end 集"
                    textSize = 13f
                    isAllCaps = false
                    setTextColor(if (isSelected) Color.WHITE else TvUi.TEXT_MUTED)
                    background = TvUi.pillBackground(active = isSelected, radius = 20f)
                    minHeight = groupMinHeight
                    setPadding(groupPadH, groupPadV, groupPadH, groupPadV)
                    setOnClickListener {
                        onGroupChanged(g)
                    }
                    setOnFocusChangeListener { v, f ->
                        v.scaleX = if (f) 1.05f else 1f
                        v.scaleY = if (f) 1.05f else 1f
                    }
                }
                groupRow.addView(groupBtn, LayoutParams(-2, groupHeight).apply {
                    marginEnd = groupMarginEnd
                })
            }
            groupScroll.addView(groupRow)
            addView(groupScroll)
        }

        // 8-Column Grid for Episodes
        val scroll = ScrollView(context)
        val episodeRows = TvUi.column(context)
        val visible = detail.episodes.drop(episodeGroup * 50).take(50)
        val gridBtnHeight = TvUi.dimen(context, R.dimen.detail_grid_btn_height)
        val gridBtnMargin = TvUi.dimen(context, R.dimen.detail_grid_btn_margin)

        visible.chunked(8).forEachIndexed { rowIndex, chunk ->
            val row = TvUi.row(context)
            chunk.forEachIndexed { offset, episode ->
                val index = episodeGroup * 50 + rowIndex * 8 + offset
                val isCurrent = index == activeIndex
                val button = Button(context).apply {
                    text = episode.number.toString()
                    textSize = 14f
                    setTextColor(Color.WHITE)
                    background = TvUi.pillBackground(active = isCurrent, radius = 10f)
                    setOnClickListener {
                        onEpisodeSelected(rowIndex * 8 + offset, index)
                    }
                    setOnFocusChangeListener { v, f ->
                        v.scaleX = if (f) 1.08f else 1f
                        v.scaleY = if (f) 1.08f else 1f
                    }
                }
                row.addView(button, LayoutParams(0, gridBtnHeight, 1f).apply {
                    setMargins(gridBtnMargin, gridBtnMargin, gridBtnMargin, gridBtnMargin)
                })
                if (rowIndex * 8 + offset == detailFocus || (detailFocus < 0 && isCurrent)) {
                    focusTargetView = button
                }
            }
            for (i in chunk.size until 8) {
                row.addView(View(context), LayoutParams(0, gridBtnHeight, 1f).apply {
                    setMargins(gridBtnMargin, gridBtnMargin, gridBtnMargin, gridBtnMargin)
                })
            }
            episodeRows.addView(row)
        }
        scroll.addView(episodeRows)
        addView(scroll, LayoutParams(-1, 0, 1f))

        if (focusTargetView == null) {
            focusTargetView = play
        }
    }
}
