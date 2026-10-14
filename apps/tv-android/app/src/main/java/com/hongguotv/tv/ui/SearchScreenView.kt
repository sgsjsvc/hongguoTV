package com.hongguotv.tv.ui

import android.content.Context
import android.graphics.Color
import android.view.KeyEvent
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import com.hongguotv.tv.R
import com.hongguotv.tv.TvUi

internal class SearchScreenView(
    context: Context,
    initialQuery: String,
    recentQueries: List<String>,
    private val onSearchSubmit: (String) -> Unit
) : LinearLayout(context) {

    val input: EditText

    init {
        orientation = VERTICAL
        setBackgroundColor(TvUi.BACKGROUND)
        val padH = TvUi.dimen(context, R.dimen.search_page_pad_h)
        val padV = TvUi.dimen(context, R.dimen.search_page_pad_v)
        setPadding(padH, padV, padH, padV)

        addView(TvUi.title(context, "搜索短剧"))

        input = EditText(context).apply {
            hint = "输入剧名或关键词"
            setText(initialQuery)
            textSize = 20f
            setTextColor(Color.WHITE)
            isSingleLine = true
            imeOptions = android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH
            background = TvUi.surface(TvUi.PANEL, TvUi.BORDER_SUBTLE, radius = 24f)
            setPadding(
                TvUi.dimen(context, R.dimen.search_input_pad_h),
                TvUi.dimen(context, R.dimen.search_input_pad_v),
                TvUi.dimen(context, R.dimen.search_input_pad_h),
                TvUi.dimen(context, R.dimen.search_input_pad_v)
            )
        }
        addView(input, LayoutParams(-1, TvUi.dimen(context, R.dimen.search_input_height)).apply {
            bottomMargin = TvUi.dimen(context, R.dimen.search_input_margin_bottom)
        })

        val submitAction = {
            val q = input.text.toString().trim()
            if (q.isNotBlank()) onSearchSubmit(q)
        }

        val searchButton = TvUi.pillButton(context, "🔍 开始搜索", active = true, submitAction).apply {
            layoutParams = LayoutParams(
                TvUi.dimen(context, R.dimen.search_btn_width),
                TvUi.dimen(context, R.dimen.search_btn_height)
            )
        }
        addView(searchButton)

        input.setOnEditorActionListener { _, actionId, event ->
            if (actionId == android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH || event?.keyCode == KeyEvent.KEYCODE_ENTER) {
                submitAction()
                true
            } else false
        }

        if (recentQueries.isNotEmpty()) {
            val recentRow = TvUi.row(context)
            recentQueries.take(6).forEach { query ->
                recentRow.addView(TvUi.pillButton(context, query) {
                    input.setText(query)
                    submitAction()
                })
            }
            addView(recentRow)
        }
    }
}
