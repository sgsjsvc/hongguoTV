package com.hongguotv.tv.ui

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import com.hongguotv.tv.R
import com.hongguotv.tv.TvUi

internal class PlayerOverlay(
    context: Context,
    private val onPlayClick: (Button) -> Unit,
    private val onNextEpisodeClick: () -> Unit,
    private val onCollectionClick: () -> Unit,
    private val onFavClick: () -> Unit,
    private val onSpeedClick: () -> Unit,
    private val onQualityClick: () -> Unit,
    private val onFocusChange: (View, Boolean) -> Unit
) : FrameLayout(context) {

    val episodeBadge: TextView
    val infoTitle: TextView
    val infoSubtitle: TextView
    val infoTags: TextView
    val infoDesc: TextView

    val playButton: Button
    val nextEpisodeButton: Button
    val collectionButton: Button
    val favButton: Button
    val speedButton: Button
    val qualityButton: Button

    val progressBox: LinearLayout
    val timeText: TextView
    val progressBar: ProgressBar

    init {
        // 1. Top-Left: "第 1 集" Pill Badge
        episodeBadge = TextView(context).apply {
            text = "第 1 集"
            textSize = 12f
            setTextColor(TvUi.RED)
            setTypeface(typeface, Typeface.BOLD)
            background = TvUi.surface(0xaa070a13.toInt(), 0x55f43f5e.toInt(), radius = 40f, strokeWidth = 2)
            setPadding(
                TvUi.dimen(context, R.dimen.hero_tag_pad_h),
                TvUi.dimen(context, R.dimen.hero_tag_pad_v),
                TvUi.dimen(context, R.dimen.hero_tag_pad_h),
                TvUi.dimen(context, R.dimen.hero_tag_pad_v)
            )
        }
        addView(episodeBadge, LayoutParams(-2, -2).apply {
            gravity = Gravity.TOP or Gravity.START
            marginStart = TvUi.dimen(context, R.dimen.hero_margin_start)
            topMargin = TvUi.dimen(context, R.dimen.hero_top_margin)
        })

        // 2. Bottom-Left Information & Action Buttons
        val bottomLeftBox = TvUi.column(context)
        infoTitle = TextView(context).apply {
            text = "@短剧精选"
            textSize = 21f
            setTextColor(Color.WHITE)
            setTypeface(typeface, Typeface.BOLD)
            setShadowLayer(8f, 0f, 2f, 0xee000000.toInt())
        }
        infoSubtitle = TextView(context).apply {
            text = "第 1 集 · 精彩内容加载中"
            textSize = 13.5f
            setTextColor(0xfff1f5f9.toInt())
            setTypeface(typeface, Typeface.BOLD)
            setShadowLayer(6f, 0f, 1f, 0xee000000.toInt())
            setPadding(0, TvUi.dimen(context, R.dimen.hero_title_pad_v), 0, TvUi.dimen(context, R.dimen.hero_title_pad_v))
        }
        infoTags = TextView(context).apply {
            text = "#短剧  #爆款推荐"
            textSize = 12f
            setTextColor(TvUi.AMBER)
            setTypeface(typeface, Typeface.BOLD)
            setShadowLayer(6f, 0f, 1f, 0xee000000.toInt())
            setPadding(0, 0, 0, TvUi.dimen(context, R.dimen.hero_meta_pad_bottom))
        }
        infoDesc = TextView(context).apply {
            text = "精彩短剧连播，高潮迭起，逆袭反转不停歇！"
            textSize = 11.5f
            setTextColor(TvUi.TEXT_MUTED)
            maxLines = 2
            setLineSpacing(TvUi.dimen(context, R.dimen.hero_desc_line_spacing).toFloat(), 1f)
            setShadowLayer(6f, 0f, 1f, 0xee000000.toInt())
        }
        val actionsRow = TvUi.row(context).apply {
            setPadding(0, TvUi.dimen(context, R.dimen.hero_desc_pad_top), 0, 0)
        }

        val actionBtnMinHeight = TvUi.dimen(context, R.dimen.action_button_min_height)
        val actionBtnHeight = TvUi.dimen(context, R.dimen.action_button_height)
        val actionBtnPadH = TvUi.dimen(context, R.dimen.action_button_pad_h)
        val actionBtnPadV = TvUi.dimen(context, R.dimen.action_button_pad_v)
        val actionBtnMarginEnd = TvUi.dimen(context, R.dimen.action_button_margin_end)

        // 1. 继续播放 / 暂停播放
        playButton = Button(context).apply {
            id = View.generateViewId()
            text = "继续播放"
            textSize = 13f
            isAllCaps = false
            setTextColor(Color.WHITE)
            background = TvUi.pillBackground(active = false, radius = 24f)
            minHeight = actionBtnMinHeight
            setPadding(actionBtnPadH, actionBtnPadV, actionBtnPadH, actionBtnPadV)
            setOnClickListener { onPlayClick(this) }
            setOnFocusChangeListener { v, f ->
                onFocusChange(v, f)
                v.scaleX = if (f) 1.06f else 1f
                v.scaleY = if (f) 1.06f else 1f
            }
        }
        actionsRow.addView(playButton, LinearLayout.LayoutParams(-2, actionBtnHeight).apply { marginEnd = actionBtnMarginEnd })

        // 2. 下一集
        nextEpisodeButton = Button(context).apply {
            id = View.generateViewId()
            text = "下一集"
            textSize = 13f
            isAllCaps = false
            setTextColor(Color.WHITE)
            background = TvUi.pillBackground(active = false, radius = 24f)
            minHeight = actionBtnMinHeight
            setPadding(actionBtnPadH, actionBtnPadV, actionBtnPadH, actionBtnPadV)
            setOnClickListener { onNextEpisodeClick() }
            setOnFocusChangeListener { v, f ->
                onFocusChange(v, f)
                v.scaleX = if (f) 1.06f else 1f
                v.scaleY = if (f) 1.06f else 1f
            }
        }
        actionsRow.addView(nextEpisodeButton, LinearLayout.LayoutParams(-2, actionBtnHeight).apply { marginEnd = actionBtnMarginEnd })

        // 3. 合集
        collectionButton = Button(context).apply {
            id = View.generateViewId()
            text = "合集：短剧 | 全集 >"
            textSize = 13f
            isAllCaps = false
            setTextColor(Color.WHITE)
            background = TvUi.pillBackground(active = false, radius = 24f)
            minHeight = actionBtnMinHeight
            setPadding(actionBtnPadH, actionBtnPadV, actionBtnPadH, actionBtnPadV)
            setOnClickListener { onCollectionClick() }
            setOnFocusChangeListener { v, f ->
                onFocusChange(v, f)
                v.scaleX = if (f) 1.06f else 1f
                v.scaleY = if (f) 1.06f else 1f
            }
        }
        actionsRow.addView(collectionButton, LinearLayout.LayoutParams(-2, actionBtnHeight).apply { marginEnd = actionBtnMarginEnd })

        // 4. 追剧
        favButton = Button(context).apply {
            id = View.generateViewId()
            text = "♥ 追剧"
            textSize = 13f
            isAllCaps = false
            setTextColor(Color.WHITE)
            background = TvUi.pillBackground(active = false, radius = 24f)
            minHeight = actionBtnMinHeight
            setPadding(actionBtnPadH, actionBtnPadV, actionBtnPadH, actionBtnPadV)
            setOnClickListener { onFavClick() }
            setOnFocusChangeListener { v, f ->
                onFocusChange(v, f)
                v.scaleX = if (f) 1.06f else 1f
                v.scaleY = if (f) 1.06f else 1f
            }
        }
        actionsRow.addView(favButton, LinearLayout.LayoutParams(-2, actionBtnHeight).apply { marginEnd = actionBtnMarginEnd })

        // 5. 倍速
        speedButton = Button(context).apply {
            id = View.generateViewId()
            text = "1.0x"
            textSize = 13f
            isAllCaps = false
            setTextColor(Color.WHITE)
            background = TvUi.pillBackground(active = false, radius = 24f)
            minHeight = actionBtnMinHeight
            setPadding(actionBtnPadH, actionBtnPadV, actionBtnPadH, actionBtnPadV)
            setOnClickListener { onSpeedClick() }
            setOnFocusChangeListener { v, f ->
                onFocusChange(v, f)
                v.scaleX = if (f) 1.06f else 1f
                v.scaleY = if (f) 1.06f else 1f
            }
        }
        actionsRow.addView(speedButton, LinearLayout.LayoutParams(-2, actionBtnHeight).apply { marginEnd = actionBtnMarginEnd })

        // 6. 清晰度
        qualityButton = Button(context).apply {
            id = View.generateViewId()
            text = "1080P"
            textSize = 13f
            isAllCaps = false
            setTextColor(Color.WHITE)
            background = TvUi.pillBackground(active = false, radius = 24f)
            minHeight = actionBtnMinHeight
            setPadding(actionBtnPadH, actionBtnPadV, actionBtnPadH, actionBtnPadV)
            setOnClickListener { onQualityClick() }
            setOnFocusChangeListener { v, f ->
                onFocusChange(v, f)
                v.scaleX = if (f) 1.06f else 1f
                v.scaleY = if (f) 1.06f else 1f
            }
        }
        actionsRow.addView(qualityButton, LinearLayout.LayoutParams(-2, actionBtnHeight))

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

        bottomLeftBox.addView(infoTitle)
        bottomLeftBox.addView(infoSubtitle)
        bottomLeftBox.addView(infoTags)
        bottomLeftBox.addView(infoDesc)
        bottomLeftBox.addView(actionsRow)

        addView(bottomLeftBox, LayoutParams(-2, -2).apply {
            gravity = Gravity.BOTTOM or Gravity.START
            marginStart = TvUi.dimen(context, R.dimen.progress_box_margin_start)
            bottomMargin = TvUi.dimen(context, R.dimen.progress_box_margin_bottom)
        })

        // Bottom Seekbar & Timestamp Row
        progressBox = TvUi.column(context)
        val timeRow = TvUi.row(context)
        timeText = TextView(context).apply {
            text = "00:00 / 00:00"
            textSize = 11.5f
            setTextColor(Color.WHITE)
            typeface = Typeface.MONOSPACE
        }
        timeRow.addView(timeText, LinearLayout.LayoutParams(-2, -2))
        progressBox.addView(timeRow)

        progressBar = ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 1000
            progressTintList = ColorStateList.valueOf(TvUi.RED)
            progressBackgroundTintList = ColorStateList.valueOf(0x44ffffff.toInt())
        }
        progressBox.addView(progressBar, LinearLayout.LayoutParams(-1, TvUi.dimen(context, R.dimen.progress_bar_height)).apply {
            topMargin = TvUi.dimen(context, R.dimen.progress_bar_margin_top)
        })
    }
}
